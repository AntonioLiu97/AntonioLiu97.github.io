"""Run from remote llmICL; pass brownian (default) or noisy-logistic.
Reads existing cached predictions only; no inference or remote writes.
Follows the BM and noisy-logistic analyzer notebooks with additional snapshots every 10 observations through 100.
"""
import copy
import json
import sys
from pathlib import Path
import pickle
import numpy as np
sys.path.insert(0, str(Path.cwd() / 'models'))
experiments={'brownian':('brownian_motion_4','Brownian motion'),
             'noisy-logistic':('noisy_logistic_map_10','Noisy logistic map')}
key=sys.argv[1] if len(sys.argv)>1 else 'brownian'
run_name,label=experiments[key]
source=f'processed_series/{run_name}.pkl'
with open(source,'rb') as f:
    run=pickle.load(f)
series=np.asarray(run['time_series'])
series=(series-series.min())/(series.max()-series.min())*7+1.5
steps=[1,2,3,4,5,6,*range(10,101,10),200,300,400,500,600,700,800,900,986]
frames=[]
for n in steps:
    pdf=copy.deepcopy(run['PDF_list'][n])
    pdf.rescale_temperature(1)
    bins=sorted(zip(pdf.bin_center_arr,pdf.bin_width_arr,pdf.bin_height_arr))
    assert all(np.isfinite(row).all() and row[1]>0 and row[2]>=0 for row in bins)
    assert np.isclose(sum(w*h for _,w,h in bins),1,atol=1e-5)
    frames.append({'context':n,'mean':float(run['rescaled_true_mean_arr'][n]),
                   'sigma':float(run['rescaled_true_sigma_arr'][n]),
                   'bins':[[round(float(v),8) for v in row] for row in bins]})
print(json.dumps({'model':f"LLaMA-2 {str(run['llama_size']).upper()}",'label':label,'source':source,'seed':int(run['random_seed']),
                  'series':np.round(series,8).tolist(),'frames':frames},separators=(',',':')))
