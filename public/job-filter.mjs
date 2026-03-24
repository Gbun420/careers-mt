export function matchesJobFilter(job, searchTerm = '', locationTerm = '') {
  const normalizedSearch = String(searchTerm || '').trim().toLowerCase();
  const normalizedLocation = String(locationTerm || '').trim().toLowerCase();
  const title = String(job?.title || '').toLowerCase();
  const company = String(job?.companyName || job?.companyId || job?.company || '').toLowerCase();
  const location = String(job?.location || '').toLowerCase();

  const matchesSearch =
    !normalizedSearch ||
    title.includes(normalizedSearch) ||
    company.includes(normalizedSearch) ||
    location.includes(normalizedSearch);

  const matchesLocation =
    !normalizedLocation ||
    normalizedLocation === 'all malta' ||
    location.includes(normalizedLocation);

  return matchesSearch && matchesLocation;
}
