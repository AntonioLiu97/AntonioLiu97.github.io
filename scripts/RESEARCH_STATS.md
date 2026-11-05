# Bio statistics

Update `assets/data/research-stats.json` manually:

- `publications`: total papers, including preprints. Count each work once.
- `first_author_publications`: first- and co-first-author papers.
- `citations`: the all-time citation total or lower bound on Google Scholar.
- `citations_lower_bound`: set to `true` to append “+” (for example, 100+).
- `citations_updated`: the actual date the citation total was checked, in `YYYY-MM-DD` format.

The confirmed counts are 12 papers and 5 first/co-first-author papers. Citations are displayed as the user-supplied lower bound of 100+. Unknown values are never displayed as zero. There are no API keys, background updates, or external requests for statistics.
