export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Envuelve handlers async de un Router Express 4 para propagar errores a next(). */
export function wrapRouterAsync(router) {
  for (const layer of router.stack) {
    if (!layer.route) continue;
    for (const stack of layer.route.stack) {
      const handle = stack.handle;
      if (typeof handle !== 'function' || handle.length >= 4) continue;
      stack.handle = function wrapped(req, res, next) {
        Promise.resolve(handle(req, res, next)).catch(next);
      };
    }
  }
  return router;
}
