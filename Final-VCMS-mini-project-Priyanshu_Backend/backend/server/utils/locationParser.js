const cityToStateMap = {
  mumbai: 'Maharashtra',
  delhi: 'Delhi',
  bangalore: 'Karnataka',
  bengaluru: 'Karnataka',
  chennai: 'Tamil Nadu',
  hyderabad: 'Telangana',
  pune: 'Maharashtra',
  kolkata: 'West Bengal',
  ahmedabad: 'Gujarat',
  jaipur: 'Rajasthan',
  vadodara: 'Gujarat',
  surat: 'Gujarat',
  lucknow: 'Uttar Pradesh',
  kanpur: 'Uttar Pradesh',
  nagpur: 'Maharashtra',
  indore: 'Madhya Pradesh',
  bhopal: 'Madhya Pradesh',
  visakhapatnam: 'Andhra Pradesh',
  patna: 'Bihar',
  ghaziabad: 'Uttar Pradesh',
  ludhiana: 'Punjab',
  agra: 'Uttar Pradesh',
  nashik: 'Maharashtra',
  faridabad: 'Haryana',
  meerut: 'Uttar Pradesh',
  rajkot: 'Gujarat',
  varanasi: 'Uttar Pradesh',
};

const validStates = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
  'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
  'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
  'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
  'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi',
]);

const toTitleCase = (value = '') =>
  value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalize = (value = '') => value.replace(/\s+/g, ' ').trim();

const parseLocationFields = ({ location = '', city = '', state = '' } = {}) => {
  let resolvedLocation = normalize(location);
  let resolvedCity = normalize(city);
  let resolvedState = normalize(state);

  const parts = resolvedLocation.split(',').map((part) => normalize(part)).filter(Boolean);

  if (!resolvedCity && parts.length > 0) {
    resolvedCity = parts[0];
  }

  if (!resolvedState && parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    const normalizedState = lastPart.toLowerCase();

    if (validStates.has(normalizedState)) {
      resolvedState = toTitleCase(lastPart);
      if (!resolvedCity) {
        resolvedCity = parts.slice(0, -1).join(', ');
      }
    }
  }

  if (resolvedCity && !resolvedState) {
    const mappedState = cityToStateMap[resolvedCity.toLowerCase()];
    if (mappedState) {
      resolvedState = mappedState;
    }
  }

  if (resolvedCity) {
    resolvedCity = toTitleCase(resolvedCity);
  }
  if (resolvedState) {
    resolvedState = toTitleCase(resolvedState);
  }

  if (!resolvedLocation && (resolvedCity || resolvedState)) {
    resolvedLocation = [resolvedCity, resolvedState].filter(Boolean).join(', ');
  }

  return {
    location: resolvedLocation,
    city: resolvedCity,
    state: resolvedState,
  };
};

module.exports = {
  parseLocationFields,
};
