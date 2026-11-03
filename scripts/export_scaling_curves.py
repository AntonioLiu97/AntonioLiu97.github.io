"""Run from remote llmICL; write selected-system aggregate losses to stdout.
Reuses Figure 1's Bhattacharyya loss, averaging across the available cached
LLaMA-2 13B runs, then a centered 10-step window (shorter at the boundaries).
No remote writes, training, or model inference.
"""
import copy
import json
import sys
from pathlib import Path
import numpy as np
from scipy.special import erf
sys.path.insert(0,str(Path.cwd()/'models'))
import pickle
result={}
for key,name in [('brownian','brownian_motion'),('noisy-logistic','noisy_logistic_map')]:
    runs=[];sources=[]
    for file in sorted(Path('processed_series').glob(name+'_*.pkl')):
        with file.open('rb') as f: run=pickle.load(f)
        if run['llama_size']!='13b': continue
        losses=[]
        for index,(pdf,mean,sigma) in enumerate(zip(run['PDF_list'],run['rescaled_true_mean_arr'],run['rescaled_true_sigma_arr'])):
            c=np.asarray(pdf.bin_center_arr);w=np.asarray(pdf.bin_width_arr)
            def cdf(x):
                if sigma==0:return np.where(x<mean,0.,1.)
                return .5*(1+erf((x-mean)/(sigma*np.sqrt(2))))
            true_mass=cdf(c+w/2)-cdf(c-w/2)
            true_mass/=true_mass.sum()
            loss=-np.log(np.sum(np.sqrt(true_mass*np.asarray(pdf.bin_height_arr)*w)))
            assert np.isfinite(loss)
            if index in [1,100,986]:
                reference=copy.deepcopy(pdf);reference.discretize(cdf,mode='cdf')
                assert np.isclose(loss,reference.BT_dist(pdf))
            losses.append(float(loss))
        runs.append(losses);sources.append(file.name)
    assert runs and len({len(r) for r in runs})==1
    mean=np.mean(runs,axis=0)
    x=np.arange(1,len(mean))
    smooth=np.array([np.mean(mean[max(0,n-5):min(len(mean),n+5)]) for n in x])
    assert np.all(smooth>0)
    # Interior points agree with the original notebook's valid convolution.
    assert np.allclose(smooth[4:995],np.convolve(mean,np.ones(10)/10,mode='valid'))
    result[key]={'runs':len(runs),'sources':sources,'metric':'Bhattacharyya distance',
                 'smoothing':10,'context':x.tolist(),'loss':np.round(smooth,9).tolist()}
print(json.dumps(result,separators=(',',':')))
