// react-test-renderer's findByType/findAllByType match a fiber's inner
// function, so a `memo()`-wrapped component must be looked up by it:
// `root.findAllByType(unmemo(Tile))`.
export function unmemo<T>(component: T): T {
  return ((component as { type?: T }).type ?? component) as T;
}
