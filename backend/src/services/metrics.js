const counters = {
  pttGranted: 0,
  pttDenied: 0,
  pttReleased: 0,
  chatSent: 0,
  socketConnects: 0,
  socketDisconnects: 0,
};

export function inc(name, by = 1) {
  if (counters[name] != null) counters[name] += by;
}

export function getCounters() {
  return { ...counters };
}
