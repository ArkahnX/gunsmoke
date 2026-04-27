// node_modules/solid-js/dist/dev.js
var sharedConfig = {
  context: void 0,
  registry: void 0,
  effects: void 0,
  done: false,
  getContextId() {
    return getContextId(this.context.count);
  },
  getNextContextId() {
    return getContextId(this.context.count++);
  }
};
function getContextId(count) {
  const num = String(count), len = num.length - 1;
  return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context) {
  sharedConfig.context = context;
}
function nextHydrateContext() {
  return {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  };
}
var IS_DEV = true;
var equalFn = (a, b) => a === b;
var $PROXY = /* @__PURE__ */ Symbol("solid-proxy");
var SUPPORTS_PROXY = typeof Proxy === "function";
var $TRACK = /* @__PURE__ */ Symbol("solid-track");
var $DEVCOMP = /* @__PURE__ */ Symbol("solid-dev-component");
var signalOptions = {
  equals: equalFn
};
var ERROR = null;
var runEffects = runQueue;
var STALE = 1;
var PENDING = 2;
var UNOWNED = {};
var NO_INIT = {};
var Owner = null;
var Transition = null;
var Scheduler = null;
var ExternalSourceConfig = null;
var Listener = null;
var Updates = null;
var Effects = null;
var ExecCount = 0;
var DevHooks = {
  afterUpdate: null,
  afterCreateOwner: null,
  afterCreateSignal: null,
  afterRegisterGraph: null
};
function createRoot(fn, detachedOwner) {
  const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === void 0 ? owner : detachedOwner, root2 = unowned ? {
    owned: null,
    cleanups: null,
    context: null,
    owner: null
  } : {
    owned: null,
    cleanups: null,
    context: current ? current.context : null,
    owner: current
  }, updateFn = unowned ? () => fn(() => {
    throw new Error("Dispose method must be an explicit argument to createRoot function");
  }) : () => fn(() => untrack(() => cleanNode(root2)));
  DevHooks.afterCreateOwner && DevHooks.afterCreateOwner(root2);
  Owner = root2;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || void 0
  };
  {
    if (options.name) s.name = options.name;
    if (options.internal) {
      s.internal = true;
    } else {
      registerGraph(s);
      if (DevHooks.afterCreateSignal) DevHooks.afterCreateSignal(s);
    }
  }
  const setter = (value2) => {
    if (typeof value2 === "function") {
      if (Transition && Transition.running && Transition.sources.has(s)) value2 = value2(s.tValue);
      else value2 = value2(s.value);
    }
    return writeSignal(s, value2);
  };
  return [readSignal.bind(s), setter];
}
function createComputed(fn, value, options) {
  const c = createComputation(fn, value, true, STALE, options);
  if (Scheduler && Transition && Transition.running) Updates.push(c);
  else updateComputation(c);
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE, options);
  if (Scheduler && Transition && Transition.running) Updates.push(c);
  else updateComputation(c);
}
function createEffect(fn, value, options) {
  runEffects = runUserEffects;
  const c = createComputation(fn, value, false, STALE, options), s = SuspenseContext && useContext(SuspenseContext);
  if (s) c.suspense = s;
  if (!options || !options.render) c.user = true;
  Effects ? Effects.push(c) : updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0, options);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || void 0;
  if (Scheduler && Transition && Transition.running) {
    c.tState = STALE;
    Updates.push(c);
  } else updateComputation(c);
  return readSignal.bind(c);
}
function isPromise(v) {
  return v && typeof v === "object" && "then" in v;
}
function createResource(pSource, pFetcher, pOptions) {
  let source;
  let fetcher;
  let options;
  if (typeof pFetcher === "function") {
    source = pSource;
    fetcher = pFetcher;
    options = pOptions || {};
  } else {
    source = true;
    fetcher = pSource;
    options = pFetcher || {};
  }
  let pr = null, initP = NO_INIT, id = null, loadedUnderTransition = false, scheduled = false, resolved = "initialValue" in options, dynamic = typeof source === "function" && createMemo(source);
  const contexts = /* @__PURE__ */ new Set(), [value, setValue] = (options.storage || createSignal)(options.initialValue), [error, setError] = createSignal(void 0), [track, trigger] = createSignal(void 0, {
    equals: false
  }), [state2, setState2] = createSignal(resolved ? "ready" : "unresolved");
  if (sharedConfig.context) {
    id = sharedConfig.getNextContextId();
    if (options.ssrLoadFrom === "initial") initP = options.initialValue;
    else if (sharedConfig.load && sharedConfig.has(id)) initP = sharedConfig.load(id);
  }
  function loadEnd(p, v, error2, key) {
    if (pr === p) {
      pr = null;
      key !== void 0 && (resolved = true);
      if ((p === initP || v === initP) && options.onHydrated) queueMicrotask(() => options.onHydrated(key, {
        value: v
      }));
      initP = NO_INIT;
      if (Transition && p && loadedUnderTransition) {
        Transition.promises.delete(p);
        loadedUnderTransition = false;
        runUpdates(() => {
          Transition.running = true;
          completeLoad(v, error2);
        }, false);
      } else completeLoad(v, error2);
    }
    return v;
  }
  function completeLoad(v, err) {
    runUpdates(() => {
      if (err === void 0) setValue(() => v);
      setState2(err !== void 0 ? "errored" : resolved ? "ready" : "unresolved");
      setError(err);
      for (const c of contexts.keys()) c.decrement();
      contexts.clear();
    }, false);
  }
  function read() {
    const c = SuspenseContext && useContext(SuspenseContext), v = value(), err = error();
    if (err !== void 0 && !pr) throw err;
    if (Listener && !Listener.user && c) {
      createComputed(() => {
        track();
        if (pr) {
          if (c.resolved && Transition && loadedUnderTransition) Transition.promises.add(pr);
          else if (!contexts.has(c)) {
            c.increment();
            contexts.add(c);
          }
        }
      });
    }
    return v;
  }
  function load(refetching = true) {
    if (refetching !== false && scheduled) return;
    scheduled = false;
    const lookup = dynamic ? dynamic() : source;
    loadedUnderTransition = Transition && Transition.running;
    if (lookup == null || lookup === false) {
      loadEnd(pr, untrack(value));
      return;
    }
    if (Transition && pr) Transition.promises.delete(pr);
    let error2;
    const p = initP !== NO_INIT ? initP : untrack(() => {
      try {
        return fetcher(lookup, {
          value: value(),
          refetching
        });
      } catch (fetcherError) {
        error2 = fetcherError;
      }
    });
    if (error2 !== void 0) {
      loadEnd(pr, void 0, castError(error2), lookup);
      return;
    } else if (!isPromise(p)) {
      loadEnd(pr, p, void 0, lookup);
      return p;
    }
    pr = p;
    if ("v" in p) {
      if (p.s === 1) loadEnd(pr, p.v, void 0, lookup);
      else loadEnd(pr, void 0, castError(p.v), lookup);
      return p;
    }
    scheduled = true;
    queueMicrotask(() => scheduled = false);
    runUpdates(() => {
      setState2(resolved ? "refreshing" : "pending");
      trigger();
    }, false);
    return p.then((v) => loadEnd(p, v, void 0, lookup), (e) => loadEnd(p, void 0, castError(e), lookup));
  }
  Object.defineProperties(read, {
    state: {
      get: () => state2()
    },
    error: {
      get: () => error()
    },
    loading: {
      get() {
        const s = state2();
        return s === "pending" || s === "refreshing";
      }
    },
    latest: {
      get() {
        if (!resolved) return read();
        const err = error();
        if (err && !pr) throw err;
        return value();
      }
    }
  });
  let owner = Owner;
  if (dynamic) createComputed(() => (owner = Owner, load(false)));
  else load(false);
  return [read, {
    refetch: (info) => runWithOwner(owner, () => load(info)),
    mutate: setValue
  }];
}
function batch(fn) {
  return runUpdates(fn, false);
}
function untrack(fn) {
  if (!ExternalSourceConfig && Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) return ExternalSourceConfig.untrack(fn);
    return fn();
  } finally {
    Listener = listener;
  }
}
function on(deps, fn, options) {
  const isArray = Array.isArray(deps);
  let prevInput;
  let defer = options && options.defer;
  return (prevValue) => {
    let input;
    if (isArray) {
      input = Array(deps.length);
      for (let i = 0; i < deps.length; i++) input[i] = deps[i]();
    } else input = deps();
    if (defer) {
      defer = false;
      return prevValue;
    }
    const result = untrack(() => fn(input, prevInput, prevValue));
    prevInput = input;
    return result;
  };
}
function onMount(fn) {
  createEffect(() => untrack(fn));
}
function onCleanup(fn) {
  if (Owner === null) console.warn("cleanups created outside a `createRoot` or `render` will never be run");
  else if (Owner.cleanups === null) Owner.cleanups = [fn];
  else Owner.cleanups.push(fn);
  return fn;
}
function getListener() {
  return Listener;
}
function getOwner() {
  return Owner;
}
function runWithOwner(o, fn) {
  const prev = Owner;
  const prevListener = Listener;
  Owner = o;
  Listener = null;
  try {
    return runUpdates(fn, true);
  } catch (err) {
    handleError(err);
  } finally {
    Owner = prev;
    Listener = prevListener;
  }
}
function startTransition(fn) {
  if (Transition && Transition.running) {
    fn();
    return Transition.done;
  }
  const l = Listener;
  const o = Owner;
  return Promise.resolve().then(() => {
    Listener = l;
    Owner = o;
    let t;
    if (Scheduler || SuspenseContext) {
      t = Transition || (Transition = {
        sources: /* @__PURE__ */ new Set(),
        effects: [],
        promises: /* @__PURE__ */ new Set(),
        disposed: /* @__PURE__ */ new Set(),
        queue: /* @__PURE__ */ new Set(),
        running: true
      });
      t.done || (t.done = new Promise((res) => t.resolve = res));
      t.running = true;
    }
    runUpdates(fn, false);
    Listener = Owner = null;
    return t ? t.done : void 0;
  });
}
var [transPending, setTransPending] = /* @__PURE__ */ createSignal(false);
function devComponent(Comp, props) {
  const c = createComputation(() => untrack(() => {
    Object.assign(Comp, {
      [$DEVCOMP]: true
    });
    return Comp(props);
  }), void 0, true, 0);
  c.props = props;
  c.observers = null;
  c.observerSlots = null;
  c.name = Comp.name;
  c.component = Comp;
  updateComputation(c);
  return c.tValue !== void 0 ? c.tValue : c.value;
}
function registerGraph(value) {
  if (Owner) {
    if (Owner.sourceMap) Owner.sourceMap.push(value);
    else Owner.sourceMap = [value];
    value.graph = Owner;
  }
  if (DevHooks.afterRegisterGraph) DevHooks.afterRegisterGraph(value);
}
function createContext(defaultValue, options) {
  const id = /* @__PURE__ */ Symbol("context");
  return {
    id,
    Provider: createProvider(id, options),
    defaultValue
  };
}
function useContext(context) {
  let value;
  return Owner && Owner.context && (value = Owner.context[context.id]) !== void 0 ? value : context.defaultValue;
}
function children(fn) {
  const children2 = createMemo(fn);
  const memo2 = createMemo(() => resolveChildren(children2()), void 0, {
    name: "children"
  });
  memo2.toArray = () => {
    const c = memo2();
    return Array.isArray(c) ? c : c != null ? [c] : [];
  };
  return memo2;
}
var SuspenseContext;
function readSignal() {
  const runningTransition = Transition && Transition.running;
  if (this.sources && (runningTransition ? this.tState : this.state)) {
    if ((runningTransition ? this.tState : this.state) === STALE) updateComputation(this);
    else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  if (runningTransition && Transition.sources.has(this)) return this.tValue;
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    if (Transition) {
      const TransitionRunning = Transition.running;
      if (TransitionRunning || !isComp && Transition.sources.has(node)) {
        Transition.sources.add(node);
        node.tValue = value;
      }
      if (!TransitionRunning) node.value = value;
    } else node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) continue;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);
            else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
          else o.tState = STALE;
        }
        if (Updates.length > 1e6) {
          Updates = [];
          if (IS_DEV) throw new Error("Potential Infinite Loop Detected.");
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value, time);
  if (Transition && !Transition.running && Transition.sources.has(node)) {
    queueMicrotask(() => {
      runUpdates(() => {
        Transition && (Transition.running = true);
        Listener = Owner = node;
        runComputation(node, node.tValue, time);
        Listener = Owner = null;
      }, false);
    });
  }
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner, listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      if (Transition && Transition.running) {
        node.tState = STALE;
        node.tOwned && node.tOwned.forEach(cleanNode);
        node.tOwned = void 0;
      } else {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue, true);
    } else if (Transition && Transition.running && node.pure) {
      if (!Transition.sources.has(node)) node.value = nextValue;
      Transition.sources.add(node);
      node.tValue = nextValue;
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state2 = STALE, options) {
  const c = {
    fn,
    state: state2,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Transition && Transition.running) {
    c.state = 0;
    c.tState = state2;
  }
  if (Owner === null) console.warn("computations created outside a `createRoot` or `render` will never be disposed");
  else if (Owner !== UNOWNED) {
    if (Transition && Transition.running && Owner.pure) {
      if (!Owner.tOwned) Owner.tOwned = [c];
      else Owner.tOwned.push(c);
    } else {
      if (!Owner.owned) Owner.owned = [c];
      else Owner.owned.push(c);
    }
  }
  if (options && options.name) c.name = options.name;
  if (ExternalSourceConfig && c.fn) {
    const sourceFn = c.fn;
    const [track, trigger] = createSignal(void 0, {
      equals: false
    });
    const ordinary = ExternalSourceConfig.factory(sourceFn, trigger);
    onCleanup(() => ordinary.dispose());
    let inTransition;
    const triggerInTransition = () => startTransition(trigger).then(() => {
      if (inTransition) {
        inTransition.dispose();
        inTransition = void 0;
      }
    });
    c.fn = (x) => {
      track();
      if (Transition && Transition.running) {
        if (!inTransition) inTransition = ExternalSourceConfig.factory(sourceFn, triggerInTransition);
        return inTransition.track(x);
      }
      return ordinary.track(x);
    };
  }
  DevHooks.afterCreateOwner && DevHooks.afterCreateOwner(c);
  return c;
}
function runTop(node) {
  const runningTransition = Transition && Transition.running;
  if ((runningTransition ? node.tState : node.state) === 0) return;
  if ((runningTransition ? node.tState : node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (runningTransition && Transition.disposed.has(node)) return;
    if (runningTransition ? node.tState : node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if (runningTransition) {
      let top = node, prev = ancestors[i + 1];
      while ((top = top.owner) && top !== prev) {
        if (Transition.disposed.has(top)) return;
      }
    }
    if ((runningTransition ? node.tState : node.state) === STALE) {
      updateComputation(node);
    } else if ((runningTransition ? node.tState : node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    if (Scheduler && Transition && Transition.running) scheduleQueue(Updates);
    else runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  let res;
  if (Transition) {
    if (!Transition.promises.size && !Transition.queue.size) {
      const sources = Transition.sources;
      const disposed = Transition.disposed;
      Effects.push.apply(Effects, Transition.effects);
      res = Transition.resolve;
      for (const e2 of Effects) {
        "tState" in e2 && (e2.state = e2.tState);
        delete e2.tState;
      }
      Transition = null;
      runUpdates(() => {
        for (const d of disposed) cleanNode(d);
        for (const v of sources) {
          v.value = v.tValue;
          if (v.owned) {
            for (let i = 0, len = v.owned.length; i < len; i++) cleanNode(v.owned[i]);
          }
          if (v.tOwned) v.owned = v.tOwned;
          delete v.tValue;
          delete v.tOwned;
          v.tState = 0;
        }
        setTransPending(false);
      }, false);
    } else if (Transition.running) {
      Transition.running = false;
      Transition.effects.push.apply(Transition.effects, Effects);
      Effects = null;
      setTransPending(true);
      return;
    }
  }
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
  else DevHooks.afterUpdate && DevHooks.afterUpdate();
  if (res) res();
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function scheduleQueue(queue) {
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const tasks = Transition.queue;
    if (!tasks.has(item)) {
      tasks.add(item);
      Scheduler(() => {
        tasks.delete(item);
        runUpdates(() => {
          Transition.running = true;
          runTop(item);
        }, false);
        Transition && (Transition.running = false);
      });
    }
  }
}
function runUserEffects(queue) {
  let i, userLength = 0;
  for (i = 0; i < queue.length; i++) {
    const e = queue[i];
    if (!e.user) runTop(e);
    else queue[userLength++] = e;
  }
  if (sharedConfig.context) {
    if (sharedConfig.count) {
      sharedConfig.effects || (sharedConfig.effects = []);
      sharedConfig.effects.push(...queue.slice(0, userLength));
      return;
    }
    setHydrateContext();
  }
  if (sharedConfig.effects && (sharedConfig.done || !sharedConfig.count)) {
    queue = [...sharedConfig.effects, ...queue];
    userLength += sharedConfig.effects.length;
    delete sharedConfig.effects;
  }
  for (i = 0; i < userLength; i++) runTop(queue[i]);
}
function lookUpstream(node, ignore) {
  const runningTransition = Transition && Transition.running;
  if (runningTransition) node.tState = 0;
  else node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state2 = runningTransition ? source.tState : source.state;
      if (state2 === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state2 === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  const runningTransition = Transition && Transition.running;
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (runningTransition ? !o.tState : !o.state) {
      if (runningTransition) o.tState = PENDING;
      else o.state = PENDING;
      if (o.pure) Updates.push(o);
      else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(), s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (Transition && Transition.running && node.pure) {
    reset(node, true);
  } else if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  if (Transition && Transition.running) node.tState = 0;
  else node.state = 0;
  delete node.sourceMap;
}
function reset(node, top) {
  if (!top) {
    node.tState = 0;
    Transition.disposed.add(node);
  }
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) reset(node.owned[i]);
  }
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function runErrors(err, fns, owner) {
  try {
    for (const f of fns) f(err);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
}
function handleError(err, owner = Owner) {
  const fns = ERROR && owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns) throw error;
  if (Effects) Effects.push({
    fn() {
      runErrors(error, fns, owner);
    },
    state: STALE
  });
  else runErrors(error, fns, owner);
}
function resolveChildren(children2) {
  if (typeof children2 === "function" && !children2.length) return resolveChildren(children2());
  if (Array.isArray(children2)) {
    const results = [];
    for (let i = 0; i < children2.length; i++) {
      const result = resolveChildren(children2[i]);
      Array.isArray(result) ? results.push.apply(results, result) : results.push(result);
    }
    return results;
  }
  return children2;
}
function createProvider(id, options) {
  return function provider(props) {
    let res;
    createRenderEffect(() => res = untrack(() => {
      Owner.context = {
        ...Owner.context,
        [id]: props.value
      };
      return children(() => props.children);
    }), void 0, options);
    return res;
  };
}
var FALLBACK = /* @__PURE__ */ Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items2 = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [], newLen = newItems.length, i, j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items2 = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items2 = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items2[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items2[start] === newItems[start]; start++) ;
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items2[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = /* @__PURE__ */ new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === void 0 ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items2[i];
          j = newIndices.get(item);
          if (j !== void 0 && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items2 = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j, {
          name: "index"
        });
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
var hydrationEnabled = false;
function createComponent(Comp, props) {
  if (hydrationEnabled) {
    if (sharedConfig.context) {
      const c = sharedConfig.context;
      setHydrateContext(nextHydrateContext());
      const r = devComponent(Comp, props || {});
      setHydrateContext(c);
      return r;
    }
  }
  return devComponent(Comp, props || {});
}
function trueFn() {
  return true;
}
var propTraps = {
  get(_, property, receiver) {
    if (property === $PROXY) return receiver;
    return _.get(property);
  },
  has(_, property) {
    if (property === $PROXY) return true;
    return _.has(property);
  },
  set: trueFn,
  deleteProperty: trueFn,
  getOwnPropertyDescriptor(_, property) {
    return {
      configurable: true,
      enumerable: true,
      get() {
        return _.get(property);
      },
      set: trueFn,
      deleteProperty: trueFn
    };
  },
  ownKeys(_) {
    return _.keys();
  }
};
function resolveSource(s) {
  return !(s = typeof s === "function" ? s() : s) ? {} : s;
}
function resolveSources() {
  for (let i = 0, length = this.length; i < length; ++i) {
    const v = this[i]();
    if (v !== void 0) return v;
  }
}
function mergeProps(...sources) {
  let proxy = false;
  for (let i = 0; i < sources.length; i++) {
    const s = sources[i];
    proxy = proxy || !!s && $PROXY in s;
    sources[i] = typeof s === "function" ? (proxy = true, createMemo(s)) : s;
  }
  if (SUPPORTS_PROXY && proxy) {
    return new Proxy({
      get(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          const v = resolveSource(sources[i])[property];
          if (v !== void 0) return v;
        }
      },
      has(property) {
        for (let i = sources.length - 1; i >= 0; i--) {
          if (property in resolveSource(sources[i])) return true;
        }
        return false;
      },
      keys() {
        const keys = [];
        for (let i = 0; i < sources.length; i++) keys.push(...Object.keys(resolveSource(sources[i])));
        return [...new Set(keys)];
      }
    }, propTraps);
  }
  const sourcesMap = {};
  const defined = /* @__PURE__ */ Object.create(null);
  for (let i = sources.length - 1; i >= 0; i--) {
    const source = sources[i];
    if (!source) continue;
    const sourceKeys = Object.getOwnPropertyNames(source);
    for (let i2 = sourceKeys.length - 1; i2 >= 0; i2--) {
      const key = sourceKeys[i2];
      if (key === "__proto__" || key === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(source, key);
      if (!defined[key]) {
        defined[key] = desc.get ? {
          enumerable: true,
          configurable: true,
          get: resolveSources.bind(sourcesMap[key] = [desc.get.bind(source)])
        } : desc.value !== void 0 ? desc : void 0;
      } else {
        const sources2 = sourcesMap[key];
        if (sources2) {
          if (desc.get) sources2.push(desc.get.bind(source));
          else if (desc.value !== void 0) sources2.push(() => desc.value);
        }
      }
    }
  }
  const target = {};
  const definedKeys = Object.keys(defined);
  for (let i = definedKeys.length - 1; i >= 0; i--) {
    const key = definedKeys[i], desc = defined[key];
    if (desc && desc.get) Object.defineProperty(target, key, desc);
    else target[key] = desc ? desc.value : void 0;
  }
  return target;
}
function splitProps(props, ...keys) {
  const len = keys.length;
  if (SUPPORTS_PROXY && $PROXY in props) {
    const blocked = len > 1 ? keys.flat() : keys[0];
    const res = keys.map((k) => {
      return new Proxy({
        get(property) {
          return k.includes(property) ? props[property] : void 0;
        },
        has(property) {
          return k.includes(property) && property in props;
        },
        keys() {
          return k.filter((property) => property in props);
        }
      }, propTraps);
    });
    res.push(new Proxy({
      get(property) {
        return blocked.includes(property) ? void 0 : props[property];
      },
      has(property) {
        return blocked.includes(property) ? false : property in props;
      },
      keys() {
        return Object.keys(props).filter((k) => !blocked.includes(k));
      }
    }, propTraps));
    return res;
  }
  const objects = [];
  for (let i = 0; i <= len; i++) {
    objects[i] = {};
  }
  for (const propName of Object.getOwnPropertyNames(props)) {
    let keyIndex = len;
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].includes(propName)) {
        keyIndex = i;
        break;
      }
    }
    const desc = Object.getOwnPropertyDescriptor(props, propName);
    const isDefaultDesc = !desc.get && !desc.set && desc.enumerable && desc.writable && desc.configurable;
    isDefaultDesc ? objects[keyIndex][propName] = desc.value : Object.defineProperty(objects[keyIndex], propName, desc);
  }
  return objects;
}
var narrowedError = (name) => `Attempting to access a stale value from <${name}> that could possibly be undefined. This may occur because you are reading the accessor returned from the component at a time where it has already been unmounted. We recommend cleaning up any stale timers or async, or reading from the initial condition.`;
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || void 0), void 0, {
    name: "value"
  });
}
function Show(props) {
  const keyed = props.keyed;
  const conditionValue = createMemo(() => props.when, void 0, {
    name: "condition value"
  });
  const condition = keyed ? conditionValue : createMemo(conditionValue, void 0, {
    equals: (a, b) => !a === !b,
    name: "condition"
  });
  return createMemo(() => {
    const c = condition();
    if (c) {
      const child = props.children;
      const fn = typeof child === "function" && child.length > 0;
      return fn ? untrack(() => child(keyed ? c : () => {
        if (!untrack(condition)) throw narrowedError("Show");
        return conditionValue();
      })) : child;
    }
    return props.fallback;
  }, void 0, {
    name: "value"
  });
}
var DEV = {
  hooks: DevHooks,
  writeSignal,
  registerGraph
};
if (globalThis) {
  if (!globalThis.Solid$$) globalThis.Solid$$ = true;
  else console.warn("You appear to have multiple instances of Solid. This can lead to unexpected behavior.");
}

// node_modules/solid-js/web/dist/dev.js
var booleans = [
  "allowfullscreen",
  "async",
  "alpha",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "hidden",
  "indeterminate",
  "inert",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected",
  "adauctionheaders",
  "browsingtopics",
  "credentialless",
  "defaultchecked",
  "defaultmuted",
  "defaultselected",
  "defer",
  "disablepictureinpicture",
  "disableremoteplayback",
  "preservespitch",
  "shadowrootclonable",
  "shadowrootcustomelementregistry",
  "shadowrootdelegatesfocus",
  "shadowrootserializable",
  "sharedstoragewritable"
];
var Properties = /* @__PURE__ */ new Set([
  "className",
  "value",
  "readOnly",
  "noValidate",
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  "adAuctionHeaders",
  "allowFullscreen",
  "browsingTopics",
  "defaultChecked",
  "defaultMuted",
  "defaultSelected",
  "disablePictureInPicture",
  "disableRemotePlayback",
  "preservesPitch",
  "shadowRootClonable",
  "shadowRootCustomElementRegistry",
  "shadowRootDelegatesFocus",
  "shadowRootSerializable",
  "sharedStorageWritable",
  ...booleans
]);
var memo = (fn) => createMemo(() => fn());
function reconcileArrays(parentNode, a, b) {
  let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, after = a[aEnd - 1].nextSibling, map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = /* @__PURE__ */ new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart, sequence = 1, t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}
var $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  if (!element) {
    throw new Error("The `element` passed to `render(..., element)` doesn't exist. Make sure `element` exists in the document.");
  }
  let disposer;
  createRoot((dispose2) => {
    disposer = dispose2;
    element === document ? code() : insert(element, code(), element.firstChild ? null : void 0, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG, isMathML) {
  let node;
  const create = () => {
    if (isHydrating()) throw new Error("Failed attempt to create new DOM elements during hydration. Check that the libraries you are using support hydration.");
    const t = isMathML ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "template") : document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : isMathML ? t.firstChild : t.content.firstChild;
  };
  const fn = isImportNode ? () => untrack(() => document.importNode(node || (node = create()), true)) : () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document2 = window.document) {
  const e = document2[$$EVENTS] || (document2[$$EVENTS] = /* @__PURE__ */ new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name = eventNames[i];
    if (!e.has(name)) {
      e.add(name);
      document2.addEventListener(name, eventHandler);
    }
  }
}
function setAttribute(node, name, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute(name);
  else node.setAttribute(name, value);
}
function className(node, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute("class");
  else node.className = value;
}
function addEventListener(node, name, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name}`] = handler[0];
      node[`$$${name}Data`] = handler[1];
    } else node[`$$${name}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name, handler[0] = (e) => handlerFn.call(node, handler[1], e));
  } else node.addEventListener(name, handler, typeof handler !== "function" && handler);
}
function style(node, value, prev) {
  if (!value) return prev ? setAttribute(node, "style") : value;
  const nodeStyle = node.style;
  if (typeof value === "string") return nodeStyle.cssText = value;
  typeof prev === "string" && (nodeStyle.cssText = prev = void 0);
  prev || (prev = {});
  value || (value = {});
  let v, s;
  for (s in prev) {
    value[s] == null && nodeStyle.removeProperty(s);
    delete prev[s];
  }
  for (s in value) {
    v = value[s];
    if (v !== prev[s]) {
      nodeStyle.setProperty(s, v);
      prev[s] = v;
    }
  }
  return prev;
}
function setStyleProperty(node, name, value) {
  value != null ? node.style.setProperty(name, value) : node.style.removeProperty(name);
}
function use(fn, element, arg) {
  return untrack(() => fn(element, arg));
}
function insert(parent, accessor, marker, initial) {
  if (marker !== void 0 && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
}
function isHydrating(node) {
  return !!sharedConfig.context && !sharedConfig.done && (!node || node.isConnected);
}
function eventHandler(e) {
  if (sharedConfig.registry && sharedConfig.events) {
    if (sharedConfig.events.find(([el, ev]) => ev === e)) return;
  }
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = (value) => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== void 0 ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host)) ;
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (sharedConfig.registry && !sharedConfig.done) sharedConfig.done = _$HY.done = true;
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  } else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  const hydrating = isHydrating(parent);
  if (hydrating) {
    !current && (current = [...parent.childNodes]);
    let cleaned = [];
    for (let i = 0; i < current.length; i++) {
      const node = current[i];
      if (node.nodeType === 8 && node.data.slice(0, 2) === "!$") node.remove();
      else cleaned.push(node);
    }
    current = cleaned;
  }
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value, multi = marker !== void 0;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (hydrating) return current;
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    if (hydrating) return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (hydrating) {
      if (!array.length) return current;
      if (marker === void 0) return current = [...parent.childNodes];
      let node = array[0];
      if (node.parentNode !== parent) return current;
      const nodes = [node];
      while ((node = node.nextSibling) !== marker) nodes.push(node);
      return current = nodes;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (hydrating && value.parentNode) return current = multi ? [value] : value;
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else console.warn(`Unrecognized value. Skipped inserting`, value);
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap2) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i], prev = current && current[normalized.length], t;
    if (item == null || item === true || item === false) ;
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap2) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
      else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === void 0) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el = current[i];
      if (node !== el) {
        const isParent = el.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el) : parent.insertBefore(node, marker);
        else isParent && el.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}
var SVG_NAMESPACE = "http://www.w3.org/2000/svg";
function createElement(tagName, isSVG = false, is = void 0) {
  return isSVG ? document.createElementNS(SVG_NAMESPACE, tagName) : document.createElement(tagName, {
    is
  });
}
function Portal(props) {
  const {
    useShadow
  } = props, marker = document.createTextNode(""), mount = () => props.mount || document.body, owner = getOwner();
  let content;
  let hydrating = !!sharedConfig.context;
  createEffect(() => {
    if (hydrating) getOwner().user = hydrating = false;
    content || (content = runWithOwner(owner, () => createMemo(() => props.children)));
    const el = mount();
    if (el instanceof HTMLHeadElement) {
      const [clean, setClean] = createSignal(false);
      const cleanup2 = () => setClean(true);
      createRoot((dispose2) => insert(el, () => !clean() ? content() : dispose2(), null));
      onCleanup(cleanup2);
    } else {
      const container = createElement(props.isSVG ? "g" : "div", props.isSVG), renderRoot = useShadow && container.attachShadow ? container.attachShadow({
        mode: "open"
      }) : container;
      Object.defineProperty(container, "_$host", {
        get() {
          return marker.parentNode;
        },
        configurable: true
      });
      insert(renderRoot, content);
      el.appendChild(container);
      props.ref && props.ref(container);
      onCleanup(() => el.removeChild(container));
    }
  }, void 0, {
    render: !hydrating
  });
  return marker;
}

// node_modules/solid-js/store/dist/dev.js
var $RAW = /* @__PURE__ */ Symbol("store-raw");
var $NODE = /* @__PURE__ */ Symbol("store-node");
var $HAS = /* @__PURE__ */ Symbol("store-has");
var $SELF = /* @__PURE__ */ Symbol("store-self");
var DevHooks2 = {
  onStoreNodeUpdate: null
};
function wrap$1(value) {
  let p = value[$PROXY];
  if (!p) {
    Object.defineProperty(value, $PROXY, {
      value: p = new Proxy(value, proxyTraps$1)
    });
    if (!Array.isArray(value)) {
      const keys = Object.keys(value), desc = Object.getOwnPropertyDescriptors(value);
      for (let i = 0, l = keys.length; i < l; i++) {
        const prop = keys[i];
        if (desc[prop].get) {
          Object.defineProperty(value, prop, {
            enumerable: desc[prop].enumerable,
            get: desc[prop].get.bind(p)
          });
        }
      }
    }
  }
  return p;
}
function isWrappable(obj) {
  let proto;
  return obj != null && typeof obj === "object" && (obj[$PROXY] || !(proto = Object.getPrototypeOf(obj)) || proto === Object.prototype || Array.isArray(obj));
}
function unwrap(item, set = /* @__PURE__ */ new Set()) {
  let result, unwrapped, v, prop;
  if (result = item != null && item[$RAW]) return result;
  if (!isWrappable(item) || set.has(item)) return item;
  if (Array.isArray(item)) {
    if (Object.isFrozen(item)) item = item.slice(0);
    else set.add(item);
    for (let i = 0, l = item.length; i < l; i++) {
      v = item[i];
      if ((unwrapped = unwrap(v, set)) !== v) item[i] = unwrapped;
    }
  } else {
    if (Object.isFrozen(item)) item = Object.assign({}, item);
    else set.add(item);
    const keys = Object.keys(item), desc = Object.getOwnPropertyDescriptors(item);
    for (let i = 0, l = keys.length; i < l; i++) {
      prop = keys[i];
      if (desc[prop].get) continue;
      v = item[prop];
      if ((unwrapped = unwrap(v, set)) !== v) item[prop] = unwrapped;
    }
  }
  return item;
}
function getNodes(target, symbol) {
  let nodes = target[symbol];
  if (!nodes) Object.defineProperty(target, symbol, {
    value: nodes = /* @__PURE__ */ Object.create(null)
  });
  return nodes;
}
function getNode(nodes, property, value) {
  if (nodes[property]) return nodes[property];
  const [s, set] = createSignal(value, {
    equals: false,
    internal: true
  });
  s.$ = set;
  return nodes[property] = s;
}
function proxyDescriptor$1(target, property) {
  const desc = Reflect.getOwnPropertyDescriptor(target, property);
  if (!desc || desc.get || !desc.configurable || property === $PROXY || property === $NODE) return desc;
  delete desc.value;
  delete desc.writable;
  desc.get = () => target[$PROXY][property];
  return desc;
}
function trackSelf(target) {
  getListener() && getNode(getNodes(target, $NODE), $SELF)();
}
function ownKeys(target) {
  trackSelf(target);
  return Reflect.ownKeys(target);
}
var proxyTraps$1 = {
  get(target, property, receiver) {
    if (property === $RAW) return target;
    if (property === $PROXY) return receiver;
    if (property === $TRACK) {
      trackSelf(target);
      return receiver;
    }
    const nodes = getNodes(target, $NODE);
    const tracked = nodes[property];
    let value = tracked ? tracked() : target[property];
    if (property === $NODE || property === $HAS || property === "__proto__") return value;
    if (!tracked) {
      const desc = Object.getOwnPropertyDescriptor(target, property);
      if (getListener() && (typeof value !== "function" || target.hasOwnProperty(property)) && !(desc && desc.get)) value = getNode(nodes, property, value)();
    }
    return isWrappable(value) ? wrap$1(value) : value;
  },
  has(target, property) {
    if (property === $RAW || property === $PROXY || property === $TRACK || property === $NODE || property === $HAS || property === "__proto__") return true;
    getListener() && getNode(getNodes(target, $HAS), property)();
    return property in target;
  },
  set() {
    console.warn("Cannot mutate a Store directly");
    return true;
  },
  deleteProperty() {
    console.warn("Cannot mutate a Store directly");
    return true;
  },
  ownKeys,
  getOwnPropertyDescriptor: proxyDescriptor$1
};
function setProperty(state2, property, value, deleting = false) {
  if (!deleting && state2[property] === value) return;
  const prev = state2[property], len = state2.length;
  DevHooks2.onStoreNodeUpdate && DevHooks2.onStoreNodeUpdate(state2, property, value, prev);
  if (value === void 0) {
    delete state2[property];
    if (state2[$HAS] && state2[$HAS][property] && prev !== void 0) state2[$HAS][property].$();
  } else {
    state2[property] = value;
    if (state2[$HAS] && state2[$HAS][property] && prev === void 0) state2[$HAS][property].$();
  }
  let nodes = getNodes(state2, $NODE), node;
  if (node = getNode(nodes, property, prev)) node.$(() => value);
  if (Array.isArray(state2) && state2.length !== len) {
    for (let i = state2.length; i < len; i++) (node = nodes[i]) && node.$();
    (node = getNode(nodes, "length", len)) && node.$(state2.length);
  }
  (node = nodes[$SELF]) && node.$();
}
function mergeStoreNode(state2, value) {
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    setProperty(state2, key, value[key]);
  }
}
function updateArray(current, next) {
  if (typeof next === "function") next = next(current);
  next = unwrap(next);
  if (Array.isArray(next)) {
    if (current === next) return;
    let i = 0, len = next.length;
    for (; i < len; i++) {
      const value = next[i];
      if (current[i] !== value) setProperty(current, i, value);
    }
    setProperty(current, "length", len);
  } else mergeStoreNode(current, next);
}
function updatePath(current, path, traversed = []) {
  let part, prev = current;
  if (path.length > 1) {
    part = path.shift();
    const partType = typeof part, isArray = Array.isArray(current);
    if (Array.isArray(part)) {
      for (let i = 0; i < part.length; i++) {
        updatePath(current, [part[i]].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (isArray && partType === "object") {
      const {
        from = 0,
        to = current.length - 1,
        by = 1
      } = part;
      for (let i = from; i <= to; i += by) {
        updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (path.length > 1) {
      updatePath(current[part], path, [part].concat(traversed));
      return;
    }
    prev = current[part];
    traversed = [part].concat(traversed);
  }
  let value = path[0];
  if (typeof value === "function") {
    value = value(prev, traversed);
    if (value === prev) return;
  }
  if (part === void 0 && value == void 0) return;
  value = unwrap(value);
  if (part === void 0 || isWrappable(prev) && isWrappable(value) && !Array.isArray(value)) {
    mergeStoreNode(prev, value);
  } else setProperty(current, part, value);
}
function createStore(...[store, options]) {
  const unwrappedStore = unwrap(store || {});
  const isArray = Array.isArray(unwrappedStore);
  if (typeof unwrappedStore !== "object" && typeof unwrappedStore !== "function") throw new Error(`Unexpected type ${typeof unwrappedStore} received when initializing 'createStore'. Expected an object.`);
  const wrappedStore = wrap$1(unwrappedStore);
  DEV.registerGraph({
    value: unwrappedStore,
    name: options && options.name
  });
  function setStore(...args) {
    batch(() => {
      isArray && args.length === 1 ? updateArray(unwrappedStore, args[0]) : updatePath(unwrappedStore, args);
    });
  }
  return [wrappedStore, setStore];
}
var producers = /* @__PURE__ */ new WeakMap();
var setterTraps = {
  get(target, property) {
    if (property === $RAW) return target;
    const value = target[property];
    let proxy;
    return isWrappable(value) ? producers.get(value) || (producers.set(value, proxy = new Proxy(value, setterTraps)), proxy) : value;
  },
  set(target, property, value) {
    setProperty(target, property, unwrap(value));
    return true;
  },
  deleteProperty(target, property) {
    setProperty(target, property, void 0, true);
    return true;
  }
};
function produce(fn) {
  return (state2) => {
    if (isWrappable(state2)) {
      let proxy;
      if (!(proxy = producers.get(state2))) {
        producers.set(state2, proxy = new Proxy(state2, setterTraps));
      }
      fn(proxy);
    }
    return state2;
  };
}

// src/types/constants.ts
var MAP_SIZE = 21;
var TILE_SIZE = 32;
var SCALE = 2;
var CANVAS_SIZE = MAP_SIZE * TILE_SIZE;
var E_PAD = 6;
var HALF_HEIGHT = Math.round(TILE_SIZE * 0.15);
var FULL_HEIGHT = Math.round(TILE_SIZE * 0.35);
var SAVE_VERSION = 7;
var STORAGE_KEY = "arenaPlannerState_v" + SAVE_VERSION;
var EDITOR_MAP_KEY = "arenaEditorMap_v1";
var SKILL_DISPLAY_KEY = "arenaSkillDisplay_v1";
var MIN_SCALE = 0.25;
var MAX_SCALE = 10;
var MAP_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: MAP_SIZE * TILE_SIZE,
  maxY: MAP_SIZE * TILE_SIZE
};

// src/store/index.ts
var mapGrid = {};
function gridKey(c, r) {
  return `${c},${r}`;
}
function cellX(c) {
  return c * TILE_SIZE;
}
function cellY(r) {
  return r * TILE_SIZE;
}
function inMapBounds(c, r) {
  return c >= 0 && c < MAP_SIZE && r >= 0 && r < MAP_SIZE;
}
function getCell(c, r) {
  const k = gridKey(c, r);
  if (!mapGrid[k]) mapGrid[k] = { cover: null, bossOrigin: null, spawn: false, bndH: false, bndV: false };
  return mapGrid[k];
}
function hasCover(c, r) {
  if (!inMapBounds(c, r)) return false;
  const cell = mapGrid[gridKey(c, r)];
  return !!cell && cell.cover !== null;
}
var allDolls = [];
var allSummons = [];
var skillOrder = ["Basic Attack", "Skill 1", "Skill 2", "Skill 3", "Passive", "Skill A", "Skill B"];
var skillOrderMap = skillOrder.reduce(
  (previousValue, currentValue, currentIndex) => ({ ...previousValue, [currentValue]: currentIndex, [currentIndex]: currentValue }),
  {}
);
var notations = {
  "Basic Attack": ["S1", "1", "BA"],
  "Skill 1": ["S2", "2", "S1"],
  "Skill 2": ["S3", "3", "S2"],
  "Skill 3": ["S4", "4", "ULT"],
  Passive: ["S5", "5", "PSV"],
  "Skill A": ["S6", "6", "SA", "1"],
  "Skill B": ["S7", "7", "SB", "2"]
};
var [editorTool, setEditorTool] = createSignal("spawn");
var [boundaryDir, setBoundaryDir] = createSignal("h");
var [editorStatus, setEditorStatus] = createSignal("Left-click / drag to place \xB7 Right-click to erase");
var [editorCoords, setEditorCoords] = createSignal("");
var [editorIoMode, setEditorIoMode] = createSignal("export");
var [editorIoText, setEditorIoText] = createSignal("");
var [showEditorIo, setShowEditorIo] = createSignal(false);
var [loaded, setLoaded] = createSignal(false);
var [overrideSkillNotations, setOverrideSkillNotations] = createSignal(false);
function makeDefaultTabData() {
  return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}
var [state, setState] = createStore({
  selectedDolls: [],
  currentTab: 0,
  skillDisplay: [0, 0, 0, 0, 0, 0, 0],
  tabData: Array.from({ length: 8 }, () => makeDefaultTabData())
});
var [showDollModal, setShowDollModal] = createSignal(false);
var [showFortificationModal, setShowFortificationModal] = createSignal(false);
var [showImportModal, setShowImportModal] = createSignal(false);
var [showExportModal, setShowExportModal] = createSignal(false);
var [showSkillDisplayModal, setShowSkillDisplayModal] = createSignal(false);
var [showTargetModal, setShowTargetModal] = createSignal(false);
var [targetSkillInfo, setTargetSkillInfo] = createSignal("");
var [targetDollId, setTargetDollId] = createSignal(null);
var [targetSkillId, setTargetSkillId] = createSignal(null);
var [activePhaseTab, setActivePhaseTab] = createSignal("All");
var [tempSelected, setTempSelected] = createSignal([]);
var [dollFortification, setDollFortification] = createSignal({});
var [zoom, setZoom] = createSignal(2);
var [offsetX, setOffsetX] = createSignal(0);
var [offsetY, setOffsetY] = createSignal(0);
function getInfoFromId(id) {
  for (const doll of allDolls) {
    if (doll.id === id) return doll;
  }
  for (const summon of allSummons) {
    if (summon.id === id) return summon;
  }
  return void 0;
}
function getDollFromId(id) {
  for (const doll of allDolls) {
    if (doll.id === id) return doll;
  }
  return void 0;
}
function getSummonFromId(id) {
  for (const summon of allSummons) {
    if (summon.id === id) return summon;
  }
  return void 0;
}
function getDollFromSummon(summon) {
  if ("dollId" in summon === false) return summon;
  return allDolls.find((d) => d.id === summon.dollId);
}
function isVisible(phase) {
  return activePhaseTab() === "All" || phase === activePhaseTab();
}
function visibleDollIndex(doll) {
  const dolls = allDolls.filter((d) => isVisible(d.phase));
  const index = dolls.findIndex((d) => d.id === doll.id);
  if (index === -1) return allDolls.length;
  return index;
}
function getSortedUsableSkills(doll) {
  const usable = (doll.skills || []).filter((s) => s.type !== "Passive" || s.name === "Escort");
  const basic = usable.filter((s) => s.type === "Basic Attack");
  const numbered = usable.filter((s) => (s.type || "").startsWith("Skill ")).sort((a, b) => parseInt((a.type || "").replace("Skill ", "")) - parseInt((b.type || "").replace("Skill ", "")));
  const rest = usable.filter((s) => !basic.includes(s) && !numbered.includes(s)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return [...basic, ...numbered, ...rest];
}
function isPlaced(dollId) {
  for (const p of state.tabData[state.currentTab].summonPositions) {
    if (p.id === dollId) return true;
  }
  const pos = state.tabData[state.currentTab].dollPositions[dollId];
  return !!pos && pos.x > -1;
}
function getFortificationFromId(id) {
  return state.selectedDolls.find((d) => d.id === id)?.fortification ?? 0;
}
function getSummonIdsFromDollIds(ids) {
  const res = [];
  for (const id of ids) {
    const info = getDollFromId(id);
    if (info?.hasSummons) res.push(...info.summons);
  }
  return res;
}
function getDollNamesAndFortifications() {
  const dolls = [];
  for (const sd of state.selectedDolls) {
    const doll = getInfoFromId(sd.id);
    if (!doll) continue;
    dolls.push(`${doll.name} (V${getFortificationFromId(sd.id)})`);
  }
  return dolls;
}
function getSelectedDollAndSummonInfo(excludeIds = []) {
  const dolls = [];
  for (const sd of state.selectedDolls) {
    const doll = getDollFromId(sd.id);
    if (!doll) continue;
    if (!excludeIds.includes(sd.id)) dolls.push(doll);
    for (const summonId of doll.summons) {
      if (!excludeIds.includes(summonId)) {
        const summon = getSummonFromId(summonId);
        if (summon) dolls.push(summon);
      }
    }
  }
  return dolls;
}
function renderAction(dollId, action) {
  const [skillId, targetId] = action;
  const doll = getInfoFromId(dollId);
  if (!doll) return "";
  const skill = doll.skills.find((s) => s.id === skillId);
  if (!skill) return "";
  if (targetId) {
    const target = getInfoFromId(targetId);
    return getSkillDisplay(skill.type) + ">" + (target?.name ?? "?");
  }
  return getSkillDisplay(skill.type);
}
function defaultActionOrder(tabIndex) {
  if (tabIndex < 0 || tabIndex > 7) return;
  const order = new Set(state.tabData[tabIndex].actionOrder);
  const unique = /* @__PURE__ */ new Set();
  setState(
    produce((s) => {
      const turn = s.tabData[tabIndex];
      for (const doll of s.selectedDolls) {
        order.add(doll.id);
        unique.add(doll.id);
        const dollInfo = getDollFromId(doll.id);
        if (dollInfo?.hasSummons) {
          for (const summonId of dollInfo.summons) {
            order.add(summonId);
            unique.add(summonId);
          }
        }
      }
      for (const dollId of order) {
        if (unique.has(dollId) === false) {
          order.delete(dollId);
        }
      }
      s.tabData[tabIndex].actionOrder = Array.from(order);
    })
  );
}
function changeSelectedDolls(newDolls) {
  const oldIds = state.selectedDolls.map((d) => d.id);
  oldIds.push(...getSummonIdsFromDollIds(oldIds));
  const newIds = newDolls.map((d) => d.id);
  newIds.push(...getSummonIdsFromDollIds(newIds));
  const removed = oldIds.filter((d) => !newIds.includes(d));
  const added = newIds.filter((d) => !oldIds.includes(d));
  setState(
    produce((s) => {
      s.selectedDolls = newDolls;
      for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
        const tab = s.tabData[tabIndex];
        for (const dollId of removed) {
          delete tab.dollPositions[dollId];
          delete tab.actions[dollId];
          const orderIndex = tab.actionOrder.indexOf(dollId);
          if (orderIndex !== -1) tab.actionOrder.splice(orderIndex, 1);
          tab.summonPositions = tab.summonPositions.filter((p) => p.id !== dollId);
        }
        for (const dollId of added) {
          tab.dollPositions[dollId] = { x: -1, y: -1 };
          tab.actions[dollId] = [];
          if (!tab.actionOrder.includes(dollId)) tab.actionOrder.push(dollId);
        }
      }
    })
  );
}
function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...state }));
  localStorage.setItem(SKILL_DISPLAY_KEY, JSON.stringify({ override: overrideSkillNotations(), skillDisplay: state.skillDisplay }));
}
function loadState(newData) {
  setState(
    produce((s) => {
      s.selectedDolls = newData.selectedDolls;
      s.currentTab = newData.currentTab;
      if (typeof newData.actionType === "number") {
        if (newData.actionType === 0) {
          newData.actionType = "0000000";
        }
        if (newData.actionType === 1) {
          newData.actionType = "1111111";
        }
        if (newData.actionType === 2) {
          newData.actionType = "2222222";
        }
      } else if (typeof newData.actionType === "string") {
        if (newData.actionType.length !== 7) {
          newData.actionType = "0000000";
        }
      }
      if (newData.actionType && typeof newData.actionType === "string" && newData.actionType.length === 7) {
        s.skillDisplay.length = 0;
        for (const character of Array.from(newData.actionType)) {
          s.skillDisplay.push(parseInt(character));
        }
      } else if (newData.skillDisplay) {
        s.skillDisplay = newData.skillDisplay;
      }
      for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
        const src = newData.tabData[tabIndex];
        const tab = s.tabData[tabIndex];
        tab.summonPositions.length = 0;
        tab.actionOrder.length = 0;
        tab.dollPositions = {};
        tab.actions = {};
        for (const doll of s.selectedDolls) {
          tab.dollPositions[doll.id] = {
            x: src.dollPositions[doll.id]?.x ?? -1,
            y: src.dollPositions[doll.id]?.y ?? -1
          };
        }
        tab.summonPositions.push(...src.summonPositions || []);
        tab.actionOrder.push(...src.actionOrder || []);
        for (const doll of s.selectedDolls) {
          tab.actions[doll.id] = [...src.actions[doll.id] ?? []];
          const dollInfo = getDollFromId(doll.id);
          if (dollInfo?.hasSummons) {
            for (const summonId of dollInfo.summons) {
              tab.actions[summonId] = [...src.actions[summonId] ?? []];
            }
          }
        }
      }
    })
  );
  for (let i = 0; i < 8; i++) defaultActionOrder(i);
}
function loadFromLocalStorage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;
  try {
    const data = JSON.parse(saved);
    if (data.version !== SAVE_VERSION) return false;
    loadState(data);
    return true;
  } catch {
    return false;
  }
}
async function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  const saved = params.get("state");
  if (!saved) return false;
  try {
    const decompressed = await decompress(saved.trim());
    const parsed = JSON.parse(decompressed);
    if (parsed.version !== SAVE_VERSION) {
      alert("Unsupported version");
      return false;
    }
    loadState(parsed);
    return true;
  } catch {
    return false;
  }
}
function setSkillDisplay(skillType, notationStyle) {
  const index = notations[skillType].indexOf(notationStyle);
  setState(
    produce((s) => {
      s.skillDisplay[skillOrder.indexOf(skillType)] = index;
    })
  );
  saveToLocalStorage();
}
function getSkillDisplay(skillType) {
  return notations[skillType][state.skillDisplay[skillOrder.indexOf(skillType)]];
}
function overrideSkillDisplay(values) {
  setState(
    produce((s) => {
      s.skillDisplay.length = 0;
      s.skillDisplay.push(...values);
    })
  );
  saveToLocalStorage();
}
async function compress(str) {
  const byteArray = new TextEncoder().encode(str);
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function decompress(b64) {
  const bytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const cs = new DecompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}
function placeDoll(id, col, row) {
  setState(
    produce((s) => {
      s.tabData[s.currentTab].dollPositions[id] = { x: col, y: row };
    })
  );
  saveToLocalStorage();
}
function placeSummon(summonId, mapId, col, row) {
  setState(
    produce((s) => {
      const positions = s.tabData[s.currentTab].summonPositions;
      const existing = positions.find((p) => p.mapId === mapId && p.id === summonId);
      if (existing) {
        existing.x = col;
        existing.y = row;
      } else {
        for (const p of positions) {
          if (p.x === col && p.y === row) return;
        }
        positions.push({ id: summonId, mapId, x: col, y: row });
      }
    })
  );
  saveToLocalStorage();
}
function attachImageToDoll(dollInfo) {
  return new Promise((resolve) => {
    if (!dollInfo.preloadedImage || !dollInfo.preloadedImage.complete) {
      const img = new Image();
      img.src = dollInfo.avatar;
      img.onload = () => resolve();
      img.onerror = () => {
        dollInfo.preloadedImage = null;
      };
      dollInfo.preloadedImage = img;
    } else resolve();
  });
}
function preloadCanvasImages() {
  return new Promise((resolve) => {
    const entries = [];
    for (const doll of getSelectedDollAndSummonInfo()) {
      entries.push(attachImageToDoll(doll));
    }
    Promise.all(entries).then(() => resolve());
  });
}
async function loadCombinedJson() {
  try {
    const res = await fetch("combined.json");
    const json = await res.json();
    for (const entry of json) {
      const doll = {
        id: entry.id,
        name: entry.name,
        phase: entry.phase,
        avatar: entry.avatar,
        rarity: entry.rarity,
        hasSummons: false,
        skills: entry.skills ? entry.skills : [],
        summons: []
      };
      if (entry.summons) {
        for (const summon of entry.summons) {
          doll.hasSummons = true;
          doll.summons.push(summon.id);
          allSummons.push({
            id: summon.id,
            dollId: entry.id,
            name: summon.name,
            avatar: summon.localImagePath,
            skills: summon.skills ? summon.skills : []
          });
        }
      }
      allDolls.push(doll);
    }
  } catch (e) {
    console.error(e);
  }
}

// src/components/TabBar.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div class="flex items-center gap-1 overflow-x-auto border-t border-[#E06C28] bg-[#C7C5CE] px-4 py-2"><div class="flex gap-3"><button>Map Editor</button><div class="mx-1 h-6 w-px self-center bg-zinc-700"></div><div class="flex gap-0"></div><button>Summary`);
var _tmpl$2 = /* @__PURE__ */ template(`<button>`);
function TabBar(props) {
  const switchToTab = (newTab) => {
    setState(produce((s) => {
      s.currentTab = newTab;
    }));
    saveToLocalStorage();
    props.onTabChange(newTab);
  };
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling;
    _el$3.$$click = () => switchToTab(-1);
    insert(_el$5, createComponent(For, {
      get each() {
        return Array.from({
          length: 8
        }, (_, i) => i);
      },
      children: (i) => (() => {
        var _el$7 = _tmpl$2();
        _el$7.$$click = () => switchToTab(i);
        insert(_el$7, i === 0 ? "Setup" : i);
        createRenderEffect(() => className(_el$7, `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${state.currentTab === i ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"}`));
        return _el$7;
      })()
    }));
    _el$6.$$click = () => switchToTab(8);
    createRenderEffect((_p$) => {
      var _v$ = `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold whitespace-nowrap transition-all ${state.currentTab === -1 ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${state.currentTab === 8 ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"}`;
      _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$6, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/canvas/editorMap.ts
function editorSerialize() {
  const tiles = [];
  const bndHSeen = /* @__PURE__ */ new Set(), bndVSeen = /* @__PURE__ */ new Set();
  for (const k in mapGrid) {
    const cell = mapGrid[k];
    const [c, r] = k.split(",").map(Number);
    if (cell.cover === "boss" && cell.bossOrigin?.[0] === c && cell.bossOrigin?.[1] === r) tiles.push({ type: "boss", c, r });
    else if (cell.cover === "hcov") tiles.push({ type: "hcov", c, r });
    else if (cell.cover === "fcov") tiles.push({ type: "fcov", c, r });
    if (cell.spawn) tiles.push({ type: "spawn", c, r });
    if (cell.bndH && !bndHSeen.has(k)) {
      bndHSeen.add(k);
      tiles.push({ type: "hbnd_h", c, r });
    }
    if (cell.bndV && !bndVSeen.has(k)) {
      bndVSeen.add(k);
      tiles.push({ type: "hbnd_v", c, r });
    }
  }
  return JSON.stringify({ cols: MAP_SIZE, rows: MAP_SIZE, tiles }, null, 2);
}
function editorDeserialize(json) {
  for (const k in mapGrid) delete mapGrid[k];
  const data = JSON.parse(json);
  for (const t of data.tiles ?? []) {
    const { type, c, r } = t;
    if (type === "boss") {
      if (inMapBounds(c + 2, r + 2)) {
        for (let dr = 0; dr < 3; dr++)
          for (let dc = 0; dc < 3; dc++) {
            const cell = getCell(c + dc, r + dr);
            cell.cover = "boss";
            cell.bossOrigin = [c, r];
            cell.spawn = false;
            cell.bndH = false;
            cell.bndV = false;
          }
      }
    } else if (type === "hcov" || type === "fcov") {
      const cell = getCell(c, r);
      cell.cover = type;
      cell.spawn = false;
      cell.bndH = false;
      cell.bndV = false;
    } else if (type === "spawn") {
      if (!hasCover(c, r)) getCell(c, r).spawn = true;
    } else if (type === "hbnd_h") {
      if (inMapBounds(c, r + 1) && !hasCover(c, r) && !hasCover(c, r + 1)) getCell(c, r).bndH = true;
    } else if (type === "hbnd_v") {
      if (inMapBounds(c + 1, r) && !hasCover(c, r) && !hasCover(c + 1, r)) getCell(c, r).bndV = true;
    }
  }
}
function saveEditorMap() {
  localStorage.setItem(EDITOR_MAP_KEY, editorSerialize());
}
function loadEditorMap() {
  const saved = localStorage.getItem(EDITOR_MAP_KEY);
  if (saved) {
    try {
      editorDeserialize(saved);
      return;
    } catch {
    }
  }
  editorResetLayout();
}
function editorClearAll() {
  for (const k in mapGrid) delete mapGrid[k];
  saveEditorMap();
}
function editorResetLayout() {
  editorClearAll();
  const defs = [
    ["spawn", 10, 15],
    ["spawn", 13, 15],
    ["spawn", 7, 15],
    ["spawn", 5, 12],
    ["spawn", 5, 8],
    ["spawn", 15, 12],
    ["spawn", 15, 8],
    ["spawn", 7, 5],
    ["spawn", 10, 5],
    ["spawn", 13, 5],
    ["hcov", 6, 14],
    ["hcov", 6, 15],
    ["hcov", 13, 14],
    ["hcov", 14, 14],
    ["hcov", 14, 13],
    ["hcov", 14, 12],
    ["hcov", 14, 11],
    ["hbnd_h", 12, 13],
    ["hbnd_h", 7, 13],
    ["hbnd_h", 8, 13],
    ["hbnd_h", 9, 16],
    ["hbnd_h", 10, 16],
    ["hbnd_h", 11, 16],
    ["fcov", 4, 12],
    ["fcov", 4, 11],
    ["hcov", 6, 9],
    ["hcov", 6, 8],
    ["hcov", 6, 7],
    ["hcov", 7, 6],
    ["hcov", 6, 6],
    ["hbnd_h", 8, 6],
    ["hbnd_h", 9, 3],
    ["hbnd_h", 10, 3],
    ["hbnd_h", 11, 3],
    ["hbnd_h", 12, 6],
    ["hbnd_h", 13, 6],
    ["hcov", 14, 5],
    ["hcov", 14, 6],
    ["fcov", 16, 8],
    ["fcov", 16, 9],
    ["hcov", 5, 17],
    ["hcov", 4, 17],
    ["hcov", 3, 13],
    ["hcov", 3, 14],
    ["hcov", 3, 15],
    ["hcov", 3, 16],
    ["hcov", 3, 17],
    ["hcov", 17, 14],
    ["hcov", 17, 15],
    ["hcov", 15, 17],
    ["hcov", 16, 17],
    ["hcov", 17, 17],
    ["hcov", 17, 16],
    ["hcov", 15, 3],
    ["hcov", 16, 3],
    ["hcov", 17, 3],
    ["hcov", 17, 4],
    ["hcov", 17, 5],
    ["hcov", 17, 6],
    ["hcov", 5, 3],
    ["hcov", 4, 3],
    ["hcov", 3, 3],
    ["hcov", 3, 4],
    ["hcov", 3, 5],
    ["hcov", 3, 6],
    ["hcov", 17, 7],
    ["boss", 9, 9]
  ];
  for (const [type, c, r] of defs) {
    if (type === "spawn") {
      if (!hasCover(c, r)) getCell(c, r).spawn = true;
    } else if (type === "hcov" || type === "fcov") {
      const cell = getCell(c, r);
      cell.cover = type;
      cell.spawn = false;
      cell.bndH = false;
      cell.bndV = false;
    } else if (type === "boss") {
      if (c + 2 < MAP_SIZE && r + 2 < MAP_SIZE) {
        let blocked = false;
        for (let dr = 0; dr < 3 && !blocked; dr++)
          for (let dc = 0; dc < 3 && !blocked; dc++) if (hasCover(c + dc, r + dr)) blocked = true;
        if (!blocked) {
          for (let dr = 0; dr < 3; dr++)
            for (let dc = 0; dc < 3; dc++) {
              const cell = getCell(c + dc, r + dr);
              cell.cover = "boss";
              cell.bossOrigin = [c, r];
              cell.spawn = false;
              cell.bndH = false;
              cell.bndV = false;
            }
        }
      }
    } else if (type === "hbnd_h") {
      if (inMapBounds(c, r + 1) && !hasCover(c, r) && !hasCover(c, r + 1)) getCell(c, r).bndH = true;
    } else if (type === "hbnd_v") {
      if (inMapBounds(c + 1, r) && !hasCover(c, r) && !hasCover(c + 1, r)) getCell(c, r).bndV = true;
    }
  }
  saveEditorMap();
}

// src/components/buttons/DarkCancel.tsx
var _tmpl$3 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=dark transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(53,65,71)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.97021,0,0,2.97021,-213.585,-174.637)><g transform=matrix(0.795495,-0.795495,0.819601,0.819601,-49.0332,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)></path></g><g transform=matrix(-0.795495,-0.795495,-0.819601,0.819601,265.742,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)>`);
function DarkCancel() {
  return _tmpl$3();
}

// src/components/buttons/DarkConfirm.tsx
var _tmpl$4 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5><g id=dark transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(53,65,71)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(1.15789,0,0,1.06452,-47.4868,-24.4244)><ellipse cx=134.5 cy=115 rx=28.5 ry=31 style=fill:none;stroke:rgb(241,176,20);stroke-width:10.79px>`);
function DarkConfirm() {
  return _tmpl$4();
}

// src/components/buttons/DarkRefresh.tsx
var _tmpl$5 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=dark transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(53,65,71)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.24134,0,0,2.36286,19.1672,-104.192)><path d="M50.621,80.491C48.658,76.796 44.621,74.259 39.965,74.259C34.777,74.259 30.358,77.409 28.72,81.8L22.548,81.8C24.379,74.598 31.338,69.232 39.634,69.232C45.874,69.232 51.358,72.268 54.471,76.838L57.19,74.259L57.19,85.571L45.265,85.571L50.621,80.491ZM22.077,85.571L34.002,85.571L29.095,90.226C30.967,94.15 35.132,96.883 39.965,96.883C45.153,96.883 49.572,93.733 51.21,89.342L56.72,89.342C54.889,96.544 47.929,101.91 39.634,101.91C33.394,101.91 27.91,98.874 24.796,94.304L22.077,96.883L22.077,85.571Z"style=fill:rgb(217,218,218)>`);
function DarkRefresh() {
  return _tmpl$5();
}

// src/components/buttons/LightCancel.tsx
var _tmpl$6 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=light transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(162,161,166)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.97021,0,0,2.97021,-213.585,-174.637)><g transform=matrix(0.795495,-0.795495,0.819601,0.819601,-49.0332,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)></path></g><g transform=matrix(-0.795495,-0.795495,-0.819601,0.819601,265.742,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)>`);
function LightCancel() {
  return _tmpl$6();
}

// src/components/buttons/LightConfirm.tsx
var _tmpl$7 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5><g id=light transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(162,161,166)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(1.15789,0,0,1.06452,-47.4868,-24.4244)><ellipse cx=134.5 cy=115 rx=28.5 ry=31 style=fill:none;stroke:rgb(241,176,20);stroke-width:10.79px>`);
function LightConfirm() {
  return _tmpl$7();
}

// src/components/buttons/LightRefresh.tsx
var _tmpl$8 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=light transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(162,161,166)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.24134,0,0,2.36286,19.1672,-104.192)><path d="M50.621,80.491C48.658,76.796 44.621,74.259 39.965,74.259C34.777,74.259 30.358,77.409 28.72,81.8L22.548,81.8C24.379,74.598 31.338,69.232 39.634,69.232C45.874,69.232 51.358,72.268 54.471,76.838L57.19,74.259L57.19,85.571L45.265,85.571L50.621,80.491ZM22.077,85.571L34.002,85.571L29.095,90.226C30.967,94.15 35.132,96.883 39.965,96.883C45.153,96.883 49.572,93.733 51.21,89.342L56.72,89.342C54.889,96.544 47.929,101.91 39.634,101.91C33.394,101.91 27.91,98.874 24.796,94.304L22.077,96.883L22.077,85.571Z"style=fill:rgb(217,218,218)>`);
function LightRefresh() {
  return _tmpl$8();
}

// src/components/buttons/Button.tsx
var _tmpl$9 = /* @__PURE__ */ template(`<div class="flex h-full shrink">`);
var _tmpl$22 = /* @__PURE__ */ template(`<button><span>`);
function Button(props) {
  return (() => {
    var _el$ = _tmpl$22(), _el$3 = _el$.firstChild;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.design !== "custom";
      },
      get children() {
        var _el$2 = _tmpl$9();
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => props.design === "cancel")() && props.color === "dark";
          },
          get children() {
            return createComponent(DarkCancel, {});
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => props.design === "confirm")() && props.color === "dark";
          },
          get children() {
            return createComponent(DarkConfirm, {});
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => props.design === "refresh")() && props.color === "dark";
          },
          get children() {
            return createComponent(DarkRefresh, {});
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => props.design === "cancel")() && props.color === "light";
          },
          get children() {
            return createComponent(LightCancel, {});
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => props.design === "confirm")() && props.color === "light";
          },
          get children() {
            return createComponent(LightConfirm, {});
          }
        }), null);
        insert(_el$2, createComponent(Show, {
          get when() {
            return memo(() => props.design === "refresh")() && props.color === "light";
          },
          get children() {
            return createComponent(LightRefresh, {});
          }
        }), null);
        return _el$2;
      }
    }), _el$3);
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.design === "cancel";
      },
      get children() {
        return props.content ?? "Cancel";
      }
    }), null);
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.design === "confirm";
      },
      get children() {
        return props.content ?? "Confirm";
      }
    }), null);
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.design === "refresh";
      },
      get children() {
        return props.content ?? "Reset";
      }
    }), null);
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.design === "custom";
      },
      get children() {
        return props.content;
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = props.disabled, _v$2 = `${props.color === "dark" ? "bg-[#1C2A32] text-[#EFEFEF]" : props.color === "light" ? "bg-[#C9C8CE] text-[#1C2A32]" : props.color === "red" ? "bg-[#944040] text-[#EFEFEF]" : ""} ${props.design === "custom" ? "h-12 max-w-87.5 px-7.5" : "h-14 max-w-87.5 min-w-60"} relative flex cursor-pointer flex-row items-center overflow-hidden rounded-sm text-xl font-bold whitespace-nowrap shadow-sm shadow-black/50 outline-3 outline-transparent transition transition-discrete duration-250 hover:outline-white hover:duration-0`, _v$3 = `grow ${props.design === "custom" ? "pr-0" : "pr-4"}`;
      _v$ !== _p$.e && (_el$.disabled = _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$3, _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/icons/Check.tsx
var _tmpl$10 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 36 36"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1.02012,0,0,1.00693,-245.655,-19.8612)><path d="M274.14,24.094L274.14,51.107C274.14,52.423 273.086,53.491 271.787,53.491L245.124,53.491C243.825,53.491 242.771,52.423 242.771,51.107L242.771,24.094C242.771,22.779 243.825,21.711 245.124,21.711L271.787,21.711C273.086,21.711 274.14,22.779 274.14,24.094Z"style=fill:white></path></g><g transform=matrix(1.04023,0,0,1.03759,-250.961,-20.8722)><rect x=245.1 y=23.971 width=26.917 height=26.986 style=fill:rgb(242,108,28)></rect></g><g transform=matrix(0.710508,0.710508,-0.626343,0.626343,-100.485,-124.002)><path d=M188.249,28.332L188.249,28.354L175.578,28.354L175.578,23.56L184.046,23.56L184.046,5.99L188.269,5.99L188.269,28.332L188.249,28.332Z style=fill:white>`);
function Check() {
  return _tmpl$10();
}

// src/components/icons/PhaseBurn.tsx
var _tmpl$11 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Burn><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(169,77,36)></path></g><g transform=matrix(0.9625,0,0,1.19355,1.75,-11.1935)><path d="M33.696,61.874C31.412,61.39 29.373,60.638 27.611,59.665C22.976,56.825 20,52.43 20,47.5C20,47.378 20.002,47.257 20.005,47.136L20,47.136C20.022,42.298 22.463,38.039 26.151,35.553L26.151,36.321L26.166,36.31L26.166,37.225C25.873,37.711 25.714,38.242 25.714,38.757C25.714,40.416 27.471,41.785 29.902,41.762C33.055,41.733 34.559,39.775 34.559,38.116C34.559,37.807 34.477,37.514 34.329,37.243L34.329,37.22C33.787,36.034 33.512,34.557 33.601,32.742C33.61,32.568 33.628,32.393 33.655,32.218L33.642,32.218C33.659,32.141 33.676,32.065 33.695,31.989C34.345,28.673 38.109,25.149 42.496,23.457C42.63,23.406 42.763,23.361 42.896,23.324C42.899,24.148 42.948,25.064 42.948,26.042C42.948,27.27 44.643,31.18 49.318,33.784C55.668,36.382 60,41.552 60,47.5C60,52.559 56.866,57.055 52.023,59.884C50.109,60.883 47.884,61.627 45.381,62.062C49.032,60.428 51.791,57.425 51.791,54.64C51.791,52.663 51.135,51.019 50.053,49.758L50.084,49.702L49.898,49.584C49.242,48.868 48.444,48.283 47.549,47.841C44.734,45.506 41.84,42.273 41.84,40.492C41.84,40.298 41.852,40.109 41.875,39.925C40.472,41.233 39.564,43.317 39.564,45.663C39.564,46.699 39.741,47.684 40.06,48.574C40.067,48.687 40.07,48.801 40.07,48.916C40.07,51.609 38.273,53.796 36.06,53.796C34.221,53.796 32.669,52.285 32.198,50.228C30.435,51.815 29.351,53.856 29.351,55.835C29.351,58.332 31.066,60.524 33.696,61.874Z"style=fill:rgb(228,102,41)>`);
function PhaseBurn() {
  return _tmpl$11();
}

// src/components/icons/PhaseCorrosion.tsx
var _tmpl$12 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Corrosion><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(96,85,189)></path></g><g><g transform=matrix(1.11111,0,0,1.25,-5.38889,-15.5)><ellipse cx=39.5 cy=58 rx=4.5 ry=4 style=fill:rgb(134,121,232)></ellipse></g><g transform=matrix(1.06667,0,0,1.23077,-4.13333,-11.2308)><ellipse cx=54.5 cy=46.5 rx=7.5 ry=6.5 style=fill:rgb(134,121,232)></ellipse></g><g transform=matrix(1.18182,0,0,1,-10.5455,1)><ellipse cx=52.5 cy=24.5 rx=5.5 ry=6.5 style=fill:rgb(134,121,232)></ellipse></g><g transform=matrix(0.884615,0,0,1.21053,4.34615,-7.68421)><ellipse cx=29 cy=36.5 rx=13 ry=9.5 style=fill:rgb(134,121,232)>`);
function PhaseCorrosion() {
  return _tmpl$12();
}

// src/components/icons/PhaseElectric.tsx
var _tmpl$13 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Electric><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(173,141,32)></path></g><path d=M50,17.5L33,17.5L25,46L42,42L34,64L58,33L40,36L50,17.5Z style=fill:rgb(235,191,33)>`);
function PhaseElectric() {
  return _tmpl$13();
}

// src/components/icons/PhaseFreeze.tsx
var _tmpl$14 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Freeze><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(48,151,166)></path></g><g><g transform=matrix(1,0,0,1.2,-2,-12.8)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(1,0,0,1.2,-2,-36.8)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(0.961538,0,0,1.13636,-0.865385,-6.02273)><ellipse cx=42.5 cy=40.5 rx=6.5 ry=5.5 style=fill:rgb(66,204,224)></ellipse></g><g transform=matrix(0.499153,0.866514,-1.03982,0.598984,85.5838,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(-0.499989,0.866032,-1.03924,-0.599987,127.511,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(-0.499153,0.866514,1.03982,0.598984,-5.78748,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(0.499989,0.866032,1.03924,-0.599987,-47.7144,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)>`);
function PhaseFreeze() {
  return _tmpl$14();
}

// src/components/icons/PhaseHydro.tsx
var _tmpl$15 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Corrosion><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(33,126,162)></path></g><g transform=matrix(1,0,0,1,2,-1.5)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"style=fill:rgb(43,168,216)></path></g><g transform=matrix(-1,0,0,-1,78.1114,81.5649)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"style=fill:rgb(43,168,216)>`);
function PhaseHydro() {
  return _tmpl$15();
}

// src/components/icons/PhaseOmni.tsx
var _tmpl$16 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Omni><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g><g transform=matrix(1.27442,0,0,1.099,-10.2998,-2.98897)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(-0.585385,1.02359,-0.954008,-0.545589,103.249,20.7405)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(0.517371,0.996336,0.97534,-0.506469,-9.83172,37.6917)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(1.13281,-1.73412e-17,1.49543e-17,-1.099,14.7335,84.989)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(-0.547687,0.991618,0.962018,0.531338,13.4075,-3.22855)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(0.55516,1.00515,-0.962018,0.531338,56.4324,-22.5184)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(227,41,85)>`);
function PhaseOmni() {
  return _tmpl$16();
}

// src/components/icons/PhasePhysical.tsx
var _tmpl$17 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Physical><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(149,148,153)></path></g><g transform=matrix(1.5625,0,0,1.2973,-20.4375,-8.14865)><path d=M39,19L52.856,28.25L52.856,46.75L39,56L25.144,46.75L25.144,28.25L39,19ZM29.023,44.16L32.903,41.57L32.903,33.43L39,29.36L45.097,33.43L45.097,41.57L48.977,44.16L48.977,30.84L39,24.18L29.023,30.84L29.023,44.16Z style=fill:rgb(201,200,206)>`);
function PhasePhysical() {
  return _tmpl$17();
}

// src/components/icons/PhaseIcon.tsx
function PhaseIcon(props) {
  switch (props.phase.toLowerCase()) {
    default:
      return null;
    case "physical":
      return createComponent(PhasePhysical, {});
    case "burn":
      return createComponent(PhaseBurn, {});
    case "electric":
      return createComponent(PhaseElectric, {});
    case "freeze":
      return createComponent(PhaseFreeze, {});
    case "corrosion":
      return createComponent(PhaseCorrosion, {});
    case "hydro":
      return createComponent(PhaseHydro, {});
    case "omni":
      return createComponent(PhaseOmni, {});
  }
}

// src/components/SmallDollChip.tsx
var _tmpl$18 = /* @__PURE__ */ template(`<div><div class="relative flex justify-center overflow-hidden bg-[#C9C8CD]"><div class="absolute top-0.5 left-0.5 h-4 w-4"></div><img loading=lazy class="h-14 w-14 object-cover object-top"></div><div>`, true, false, false);
var _tmpl$23 = /* @__PURE__ */ template(`<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">`);
function SmallDollChip(props) {
  const interactive = typeof props.onClick !== "undefined" || typeof props.onDragStart !== "undefined" || typeof props.onMouseDown !== "undefined" || typeof props.onTouchStart !== "undefined";
  return (() => {
    var _el$ = _tmpl$18(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$2.nextSibling;
    addEventListener(_el$, "touchstart", props.onTouchStart, true);
    addEventListener(_el$, "mousedown", props.onMouseDown, true);
    addEventListener(_el$, "dragstart", props.onDragStart);
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$6 = _tmpl$23();
        insert(_el$6, createComponent(Check, {}));
        return _el$6;
      })();
    })(), _el$3);
    insert(_el$3, createComponent(PhaseIcon, {
      get phase() {
        return props.doll.phase;
      }
    }));
    insert(_el$5, () => props.target.name);
    createRenderEffect((_p$) => {
      var _v$ = props.draggable, _v$2 = props.style, _v$3 = `relative box-border flex max-h-17 w-14 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "cursor-pointer outline-3 hover:scale-107 hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"}`, _v$4 = props.target.avatar, _v$5 = `max-h-fit overflow-hidden border-t-3 bg-[#1C2A32] p-1 text-center text-xs font-bold overflow-ellipsis whitespace-nowrap text-[#EFEFEF] ${props.doll.rarity === "Elite" ? "border-t-[#DF9E00]" : "border-t-[#7968BA]"}`;
      _v$ !== _p$.e && setAttribute(_el$, "draggable", _p$.e = _v$);
      _p$.t = style(_el$, _v$2, _p$.t);
      _v$3 !== _p$.a && className(_el$, _p$.a = _v$3);
      _v$4 !== _p$.o && setAttribute(_el$4, "src", _p$.o = _v$4);
      _v$5 !== _p$.i && className(_el$5, _p$.i = _v$5);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click", "mousedown", "touchstart"]);

// src/canvas/draw.ts
function drawFloor(ctx3, c, r) {
  const distance = Math.abs(c - 10) + Math.abs(r - 10);
  const x = cellX(c), y = cellY(r);
  ctx3.fillStyle = "#18181b";
  ctx3.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx3.strokeStyle = "#27272a";
  ctx3.lineWidth = 1;
  ctx3.strokeRect(x + 0.5, y + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
  ctx3.font = `bold ${fontSize}px Roboto, sans-serif`;
  ctx3.textAlign = "center";
  ctx3.textBaseline = "top";
  const labelW = Math.ceil(ctx3.measureText(distance + "").width) + 4;
  ctx3.fillRect(x + 6, y + 2, labelW, fontSize + 2);
  ctx3.fillStyle = "#27272a";
  ctx3.fillText(distance + "", x + 6, y + 2);
}
function drawSpawn(ctx3, c, r) {
  const x = cellX(c), y = cellY(r);
  ctx3.fillStyle = "rgba(18,60,180,0.18)";
  ctx3.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  ctx3.strokeStyle = "#3070ee";
  ctx3.lineWidth = 1;
  ctx3.strokeRect(x + 1.5, y + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
  ctx3.strokeStyle = "rgba(60,120,255,0.25)";
  ctx3.lineWidth = 1;
  ctx3.strokeRect(x + 4.5, y + 4.5, TILE_SIZE - 9, TILE_SIZE - 9);
  const cx2 = Math.round(x + TILE_SIZE / 2), cy2 = Math.round(y + TILE_SIZE / 2);
  ctx3.beginPath();
  ctx3.moveTo(cx2 - 6, cy2 - 3);
  ctx3.lineTo(cx2 - 6, cy2 + 3);
  ctx3.moveTo(cx2 + 6, cy2 - 3);
  ctx3.lineTo(cx2 + 6, cy2 + 3);
  ctx3.strokeStyle = "#4888ff";
  ctx3.lineWidth = 1;
  ctx3.stroke();
  ctx3.beginPath();
  ctx3.moveTo(cx2 - 6, cy2);
  ctx3.lineTo(cx2 - 2, cy2);
  ctx3.moveTo(cx2 + 2, cy2);
  ctx3.lineTo(cx2 + 6, cy2);
  ctx3.strokeStyle = "#4888ff";
  ctx3.lineWidth = 1;
  ctx3.stroke();
  ctx3.beginPath();
  ctx3.moveTo(cx2 - 2, cy2 - 3);
  ctx3.lineTo(cx2 + 3, cy2);
  ctx3.lineTo(cx2 - 2, cy2 + 3);
  ctx3.closePath();
  ctx3.fillStyle = "#4888ff";
  ctx3.fill();
}
function drawHBoundary(ctx3, c, r) {
  const x = cellX(c), y = cellY(r), THICK = 5;
  const wy = y + TILE_SIZE - Math.floor(THICK / 2);
  ctx3.fillStyle = "#2e2618";
  ctx3.fillRect(x, wy - 1, TILE_SIZE, THICK);
  ctx3.fillStyle = "#453a28";
  ctx3.fillRect(x, wy - 1, TILE_SIZE, 2);
  const posts = [x + Math.round(TILE_SIZE * 0.1), x + Math.round(TILE_SIZE * 0.45), x + Math.round(TILE_SIZE * 0.8)];
  posts.forEach((px) => {
    ctx3.fillStyle = "#554535";
    ctx3.fillRect(px - 2, wy - 2, 4, THICK + 2);
  });
  ctx3.fillStyle = "#100e08";
  ctx3.fillRect(x + Math.round(TILE_SIZE * 0.1) + 2, wy + 1, Math.round(TILE_SIZE * 0.33) - 2, THICK - 3);
  ctx3.fillRect(x + Math.round(TILE_SIZE * 0.45) + 2, wy + 1, Math.round(TILE_SIZE * 0.33) - 2, THICK - 3);
  ctx3.strokeStyle = "#706040";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, wy - 0.5);
  ctx3.lineTo(x + TILE_SIZE, wy - 0.5);
  ctx3.stroke();
}
function drawVBoundary(ctx3, c, r) {
  const x = cellX(c), y = cellY(r), THICK = 5;
  const wx = x + TILE_SIZE - Math.floor(THICK / 2);
  ctx3.fillStyle = "#2e2618";
  ctx3.fillRect(wx - 1, y, THICK, TILE_SIZE);
  ctx3.fillStyle = "#453a28";
  ctx3.fillRect(wx - 1, y, 2, TILE_SIZE);
  const posts = [y + Math.round(TILE_SIZE * 0.1), y + Math.round(TILE_SIZE * 0.45), y + Math.round(TILE_SIZE * 0.8)];
  posts.forEach((py) => {
    ctx3.fillStyle = "#554535";
    ctx3.fillRect(wx - 2, py - 2, THICK + 2, 4);
  });
  ctx3.fillStyle = "#100e08";
  ctx3.fillRect(wx + 1, y + Math.round(TILE_SIZE * 0.1) + 2, THICK - 3, Math.round(TILE_SIZE * 0.33) - 2);
  ctx3.fillRect(wx + 1, y + Math.round(TILE_SIZE * 0.45) + 2, THICK - 3, Math.round(TILE_SIZE * 0.33) - 2);
  ctx3.strokeStyle = "#706040";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(wx - 0.5, y);
  ctx3.lineTo(wx - 0.5, y + TILE_SIZE);
  ctx3.stroke();
}
function drawHalfCover(ctx3, c, r) {
  const x = cellX(c), y = cellY(r);
  const blockTop = y - HALF_HEIGHT, fullH = TILE_SIZE + HALF_HEIGHT;
  ctx3.fillStyle = "#28401e";
  ctx3.fillRect(x, blockTop, TILE_SIZE, fullH);
  ctx3.fillStyle = "#344f28";
  ctx3.fillRect(x + 1, blockTop + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  ctx3.strokeStyle = "#44622e";
  ctx3.lineWidth = 1;
  ctx3.strokeRect(x + 3.5, blockTop + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);
  const midY = Math.round(blockTop + TILE_SIZE / 2) + 0.5;
  ctx3.beginPath();
  ctx3.moveTo(x + 2, midY);
  ctx3.lineTo(x + TILE_SIZE - 2, midY);
  ctx3.strokeStyle = "#2a3e20";
  ctx3.lineWidth = 1;
  ctx3.stroke();
  ctx3.fillStyle = "#1e2e14";
  ctx3.fillRect(x + 1, blockTop + TILE_SIZE, TILE_SIZE - 2, HALF_HEIGHT - 1);
  ctx3.strokeStyle = "#4e6838";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, blockTop + 0.5);
  ctx3.lineTo(x + TILE_SIZE, blockTop + 0.5);
  ctx3.stroke();
  ctx3.strokeStyle = "#3a5028";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, blockTop + TILE_SIZE + 0.5);
  ctx3.lineTo(x + TILE_SIZE, blockTop + TILE_SIZE + 0.5);
  ctx3.stroke();
  ctx3.strokeStyle = "#1a2810";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x + 0.5, blockTop);
  ctx3.lineTo(x + 0.5, blockTop + fullH);
  ctx3.stroke();
  ctx3.beginPath();
  ctx3.moveTo(x + TILE_SIZE - 0.5, blockTop);
  ctx3.lineTo(x + TILE_SIZE - 0.5, blockTop + fullH);
  ctx3.stroke();
}
function drawFullCover(ctx3, c, r) {
  const x = cellX(c), y = cellY(r);
  const blockTop = y - FULL_HEIGHT, fullH = TILE_SIZE + FULL_HEIGHT;
  ctx3.fillStyle = "#301e0a";
  ctx3.fillRect(x, blockTop, TILE_SIZE, fullH);
  ctx3.fillStyle = "#3e2810";
  ctx3.fillRect(x + 1, blockTop + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  ctx3.strokeStyle = "#5a3e1e";
  ctx3.lineWidth = 1;
  ctx3.strokeRect(x + 3.5, blockTop + 3.5, TILE_SIZE - 7, TILE_SIZE - 7);
  const midX = Math.round(x + TILE_SIZE / 2) + 0.5;
  const midY = Math.round(blockTop + TILE_SIZE / 2) + 0.5;
  ctx3.beginPath();
  ctx3.moveTo(midX, blockTop + 3);
  ctx3.lineTo(midX, blockTop + TILE_SIZE - 3);
  ctx3.moveTo(x + 3, midY);
  ctx3.lineTo(x + TILE_SIZE - 3, midY);
  ctx3.strokeStyle = "#2c1c08";
  ctx3.lineWidth = 1;
  ctx3.stroke();
  ctx3.fillStyle = "#221406";
  ctx3.fillRect(x + 1, blockTop + TILE_SIZE, TILE_SIZE - 2, FULL_HEIGHT - 1);
  ctx3.strokeStyle = "#6e5030";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, blockTop + 0.5);
  ctx3.lineTo(x + TILE_SIZE, blockTop + 0.5);
  ctx3.stroke();
  ctx3.strokeStyle = "#4c3418";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, blockTop + TILE_SIZE + 0.5);
  ctx3.lineTo(x + TILE_SIZE, blockTop + TILE_SIZE + 0.5);
  ctx3.stroke();
  ctx3.strokeStyle = "#180e04";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x + 0.5, blockTop);
  ctx3.lineTo(x + 0.5, blockTop + fullH);
  ctx3.stroke();
  ctx3.beginPath();
  ctx3.moveTo(x + TILE_SIZE - 0.5, blockTop);
  ctx3.lineTo(x + TILE_SIZE - 0.5, blockTop + fullH);
  ctx3.stroke();
}
function drawBoss(ctx3, c, r) {
  const x = cellX(c), y = cellY(r);
  const W = TILE_SIZE * 3, topY = y - FULL_HEIGHT, blockBodyH = TILE_SIZE * 3, fullH = blockBodyH + FULL_HEIGHT;
  ctx3.fillStyle = "#1e0606";
  ctx3.fillRect(x, topY, W, fullH);
  ctx3.fillStyle = "#280c0c";
  ctx3.fillRect(x + 1, topY + 1, W - 2, blockBodyH - 2);
  ctx3.fillStyle = "#160404";
  ctx3.fillRect(x + 1, topY + blockBodyH, W - 2, FULL_HEIGHT - 1);
  for (let i = 1; i < 3; i++) {
    ctx3.strokeStyle = "#1e0808";
    ctx3.lineWidth = 1;
    ctx3.beginPath();
    ctx3.moveTo(x + TILE_SIZE * i + 0.5, topY);
    ctx3.lineTo(x + TILE_SIZE * i + 0.5, topY + blockBodyH);
    ctx3.stroke();
    ctx3.beginPath();
    ctx3.moveTo(x, topY + TILE_SIZE * i + 0.5);
    ctx3.lineTo(x + W, topY + TILE_SIZE * i + 0.5);
    ctx3.stroke();
  }
  ctx3.strokeStyle = "#701818";
  ctx3.lineWidth = 1;
  ctx3.strokeRect(x + 3.5, topY + 3.5, W - 7, blockBodyH - 7);
  ctx3.beginPath();
  ctx3.moveTo(x + 10, topY + 10);
  ctx3.lineTo(x + W - 10, topY + blockBodyH - 10);
  ctx3.moveTo(x + W - 10, topY + 10);
  ctx3.lineTo(x + 10, topY + blockBodyH - 10);
  ctx3.strokeStyle = "#501010";
  ctx3.lineWidth = 1;
  ctx3.stroke();
  ctx3.strokeStyle = "#aa5050";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, topY + 0.5);
  ctx3.lineTo(x + W, topY + 0.5);
  ctx3.stroke();
  ctx3.strokeStyle = "#883838";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x, topY + blockBodyH + 0.5);
  ctx3.lineTo(x + W, topY + blockBodyH + 0.5);
  ctx3.stroke();
  ctx3.strokeStyle = "#200808";
  ctx3.lineWidth = 1;
  ctx3.beginPath();
  ctx3.moveTo(x + 0.5, topY);
  ctx3.lineTo(x + 0.5, topY + fullH);
  ctx3.stroke();
  ctx3.beginPath();
  ctx3.moveTo(x + W - 0.5, topY);
  ctx3.lineTo(x + W - 0.5, topY + fullH);
  ctx3.stroke();
  ctx3.font = "500 11px sans-serif";
  ctx3.fillStyle = "#cc6060";
  ctx3.textAlign = "center";
  ctx3.textBaseline = "middle";
  ctx3.fillText("BOSS", x + W / 2, topY + blockBodyH / 2);
}
function obscured(x, y, dollGrid) {
  const tileBelow = mapGrid[gridKey(x, y + 1)];
  const currentTile = mapGrid[gridKey(x, y)];
  if (currentTile) {
    if (currentTile.bndH || currentTile.bndV) return true;
  }
  if (tileBelow) {
    if (tileBelow.cover === "boss" || tileBelow.cover === "hcov" || tileBelow.cover === "fcov") return true;
  }
  if (dollGrid) {
    const doll = dollGrid[gridKey(x, y + 1)];
    if (doll) return true;
  }
  return false;
}
function drawMapTilesOnArena(ctx3, drag3, currentTab) {
  const dolls = {};
  state.selectedDolls.forEach((doll) => {
    const pos = state.tabData[currentTab]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
    if (pos.x === -1 || pos.y === -1) return;
    const tileBelow = mapGrid[gridKey(pos.x, pos.y + 1)];
    dolls[gridKey(pos.x, pos.y)] = {
      x: pos.x,
      y: pos.y,
      id: doll.id,
      instanceId: null,
      dollInfo: getInfoFromId(doll.id),
      summonInfo: null,
      dragId: drag3?.id,
      dragInstanceId: drag3?.instanceId,
      obscured: obscured(pos.x, pos.y)
    };
  });
  if (currentTab >= 1) {
    state.tabData[currentTab].summonPositions.forEach((entry) => {
      const summon = getInfoFromId(entry.id);
      if (summon) {
        const tileBelow = mapGrid[gridKey(entry.x, entry.y + 1)];
        dolls[gridKey(entry.x, entry.y)] = {
          x: entry.x,
          y: entry.y,
          id: entry.id,
          instanceId: entry.mapId,
          dollInfo: getInfoFromId(summon.dollId),
          summonInfo: summon,
          dragId: drag3?.id,
          dragInstanceId: drag3?.instanceId,
          obscured: obscured(entry.x, entry.y)
        };
      }
    });
  }
  for (const [grid, entry] of Object.entries(dolls)) {
    entry.obscured = obscured(entry.x, entry.y, dolls);
  }
  for (let row = 0; row < MAP_SIZE; row++) for (let col = 0; col < MAP_SIZE; col++) drawFloor(ctx3, col, row);
  for (let row = 0; row < MAP_SIZE; row++) {
    for (let col = 0; col < MAP_SIZE; col++) {
      const cell = mapGrid[gridKey(col, row)];
      const doll = dolls[gridKey(col, row)];
      if (currentTab < 1) {
        if (cell?.spawn) drawSpawn(ctx3, col, row);
      }
      if (doll) {
        drawDollOnCanvas(ctx3, doll);
      }
      if (!cell) continue;
      if (cell.bndH) drawHBoundary(ctx3, col, row);
      if (cell.bndV) drawVBoundary(ctx3, col, row);
      if (cell.cover === "boss" && cell.bossOrigin?.[0] === col && cell.bossOrigin?.[1] === row) drawBoss(ctx3, col, row);
      else if (cell.cover === "hcov") drawHalfCover(ctx3, col, row);
      else if (cell.cover === "fcov") drawFullCover(ctx3, col, row);
    }
  }
}
function drawDollOnCanvas(ctx3, data) {
  if (!data.dollInfo) return;
  const cx = Math.round(data.x * TILE_SIZE + TILE_SIZE / 2);
  const cy = Math.round(data.y * TILE_SIZE + TILE_SIZE / 2);
  const r = Math.round(TILE_SIZE * 0.475);
  const avatarOffY = Math.round(TILE_SIZE * 0.06);
  if (data.summonInfo && data.summonInfo.preloadedImage?.complete) {
    ctx3.save();
    if (data.instanceId === data.dragInstanceId) {
      ctx3.globalAlpha = 0.25;
    }
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
    ctx3.clip();
    ctx3.imageSmoothingEnabled = true;
    ctx3.imageSmoothingQuality = "high";
    ctx3.drawImage(data.summonInfo.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
    ctx3.restore();
  } else if (data.dollInfo.preloadedImage?.complete) {
    ctx3.save();
    if (data.id === data.dragId) {
      ctx3.globalAlpha = 0.25;
    }
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
    ctx3.clip();
    ctx3.imageSmoothingEnabled = true;
    ctx3.imageSmoothingQuality = "high";
    ctx3.drawImage(data.dollInfo.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
    ctx3.restore();
  }
  const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
  ctx3.font = `bold ${fontSize}px Roboto, sans-serif`;
  ctx3.textAlign = "center";
  ctx3.textBaseline = "top";
  let labelY = Math.round(cy + r - avatarOffY + 1);
  if (data.obscured) {
    labelY = Math.round(cy - r - avatarOffY + 1 - fontSize - 2);
  }
  ctx3.fillStyle = "rgba(0,0,0,0.75)";
  if (data.summonInfo) {
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
    ctx3.strokeStyle = "#2dd4bf";
    ctx3.lineWidth = 2;
    ctx3.stroke();
    const labelW = Math.ceil(ctx3.measureText(data.summonInfo.name).width) + 4;
    ctx3.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
    ctx3.fillStyle = "#2dd4bf";
    ctx3.fillText(data.summonInfo.name, cx, labelY + 1);
  } else {
    const labelW = Math.ceil(ctx3.measureText(data.dollInfo.name).width) + 4;
    ctx3.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
    ctx3.fillStyle = "#ffffff";
    ctx3.fillText(data.dollInfo.name, cx, labelY + 1);
  }
}
function drawGhostOnCanvas(ctx3, tileX, tileY, dollId, valid) {
  if (!dollId) return;
  const info = getInfoFromId(dollId);
  if (!info) return;
  const cx = Math.round(tileX * TILE_SIZE + TILE_SIZE / 2);
  const cy = Math.round(tileY * TILE_SIZE + TILE_SIZE / 2);
  const r = Math.round(TILE_SIZE * 0.475);
  const avatarOffY = Math.round(TILE_SIZE * 0.06);
  if (info.preloadedImage?.complete) {
    ctx3.save();
    ctx3.globalAlpha = 0.6;
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
    ctx3.clip();
    ctx3.imageSmoothingEnabled = true;
    ctx3.imageSmoothingQuality = "high";
    ctx3.drawImage(info.preloadedImage, cx - r, cy - avatarOffY - r, r * 2, r * 2);
    ctx3.restore();
  }
  ctx3.save();
  ctx3.beginPath();
  ctx3.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
  if (valid) {
    ctx3.strokeStyle = "#2dd4bf";
  } else {
    ctx3.strokeStyle = "#D42D43";
  }
  ctx3.lineWidth = 2;
  ctx3.stroke();
  ctx3.restore();
  const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
  ctx3.font = `bold ${fontSize}px Roboto, sans-serif`;
  ctx3.textAlign = "center";
  ctx3.textBaseline = "top";
  const labelY = Math.round(cy + r - avatarOffY + 1);
  const labelW = Math.ceil(ctx3.measureText(info.name).width) + 4;
  ctx3.fillStyle = "rgba(0,0,0,0.75)";
  ctx3.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
  ctx3.fillStyle = "#ffffff";
  ctx3.fillText(info.name, cx, labelY + 1);
}

// src/components/ArenaCanvas.tsx
var _tmpl$19 = /* @__PURE__ */ template(`<canvas class=shadow-2xl>`);
var canvasEl;
var ctx;
var dpr = 1;
var draggingCharId = null;
var camera = {
  x: MAP_BOUNDS.maxX / 2,
  y: MAP_BOUNDS.maxY / 2,
  scale: 2
};
var isPanning = false;
var lastMouse = {
  x: 0,
  y: 0
};
var activeTouches = /* @__PURE__ */ new Map();
var lastPinchDist = null;
var drag = null;
function tileKey(col, row) {
  return `${col},${row}`;
}
function getObjectAtWorld(tileX, tileY) {
  const tab = state.tabData[state.currentTab];
  for (const [dollId, position] of Object.entries(tab.dollPositions)) {
    if (position.x === tileX && position.y === tileY) {
      return {
        id: dollId,
        instanceId: null,
        screenX: 0,
        screenY: 0,
        currentTileX: position.x,
        currentTileY: position.y,
        isValid: true
      };
    }
  }
  for (const position of tab.summonPositions) {
    if (position.x === tileX && position.y === tileY) {
      return {
        id: position.id,
        instanceId: position.mapId,
        screenX: 0,
        screenY: 0,
        currentTileX: position.x,
        currentTileY: position.y,
        isValid: true
      };
    }
  }
  return null;
}
function commitDrop(tileX, tileY, id, instanceId) {
  const isOccupied = isDollAtTile(tileX, tileY, id, instanceId);
  const isValid = isValidMapPosition(tileX, tileY) && !isOccupied;
  if (isValid) {
    if (instanceId) {
      placeSummon(id, instanceId, tileX, tileY);
    } else {
      placeDoll(id, tileX, tileY);
    }
  }
}
function fitToWindow() {
  dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvasEl.style.width = `${cssW}px`;
  canvasEl.style.height = `${cssH}px`;
  canvasEl.width = Math.round(cssW * dpr);
  canvasEl.height = Math.round(cssH * dpr);
  clampCamera();
}
function screenToWorld(sx, sy) {
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const x = (sx - cssW / 2) / camera.scale + camera.x;
  const y = (sy - cssH / 2) / camera.scale + camera.y;
  return {
    x,
    tileX: Math.floor(x / TILE_SIZE),
    y,
    tileY: Math.floor(y / TILE_SIZE)
  };
}
function minScaleForBounds() {
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const scaleX = cssW / MAP_BOUNDS.maxX;
  const scaleY = cssH / MAP_BOUNDS.maxY;
  return Math.max(MIN_SCALE, Math.min(scaleX, scaleY));
}
function clampCamera() {
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const minScale = minScaleForBounds();
  camera.scale = Math.max(minScale, Math.min(MAX_SCALE, camera.scale));
  const halfW = cssW / 2 / camera.scale;
  const halfH = cssH / 2 / camera.scale;
  const mapW = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const mapH = MAP_BOUNDS.maxY - MAP_BOUNDS.minY;
  if (mapW <= halfW * 2) {
    camera.x = MAP_BOUNDS.minX + mapW / 2;
  } else {
    camera.x = Math.max(MAP_BOUNDS.minX + halfW, Math.min(MAP_BOUNDS.maxX - halfW, camera.x));
  }
  if (mapH <= halfH * 2) {
    camera.y = MAP_BOUNDS.minY + mapH / 2;
  } else {
    camera.y = Math.max(MAP_BOUNDS.minY + halfH, Math.min(MAP_BOUNDS.maxY - halfH, camera.y));
  }
}
function zoomAt(cssPx, cssPy, factor) {
  const before = screenToWorld(cssPx, cssPy);
  camera.scale *= factor;
  clampCamera();
  const after = screenToWorld(cssPx, cssPy);
  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  clampCamera();
}
function applyCamera() {
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const s = camera.scale * dpr;
  const tx = (cssW / 2 - camera.x * camera.scale) * dpr;
  const ty = (cssH / 2 - camera.y * camera.scale) * dpr;
  ctx.setTransform(s, 0, 0, s, tx, ty);
}
function draw() {
  if (!ctx) return;
  if (state.currentTab < 0 || state.currentTab > 7) return;
  const {
    width,
    height
  } = canvasEl;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  applyCamera();
  drawMapTilesOnArena(ctx, drag, state.currentTab);
  if (drag) {
    drawGhostOnCanvas(ctx, drag.currentTileX, drag.currentTileY, drag.id, drag.isValid);
  }
}
function loop() {
  draw();
  requestAnimationFrame(() => loop());
}
function beginExternalDrag(id, instanceId, e) {
  const getXY = (ev) => "touches" in ev ? {
    x: ev.touches[0].clientX,
    y: ev.touches[0].clientY
  } : {
    x: ev.clientX,
    y: ev.clientY
  };
  const {
    x,
    y
  } = getXY(e);
  drag = {
    id,
    instanceId,
    screenX: x,
    screenY: y,
    currentTileX: -1,
    currentTileY: -1,
    isValid: false
  };
  const onMove = (ev) => {
    if (!drag) return;
    const {
      x: cx,
      y: cy
    } = getXY(ev);
    drag.screenX = cx;
    drag.screenY = cy;
    updateExternalDrag(cx, cy);
  };
  const onUp = (ev) => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onUp);
    if (drag?.isValid) {
      commitExternalDrop(drag.currentTileX, drag.currentTileY, id, instanceId);
    }
    drag = null;
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("touchmove", onMove, {
    passive: false
  });
  window.addEventListener("touchend", onUp);
}
function updateExternalDrag(clientX, clientY) {
  if (!drag) return;
  const rect = canvasEl.getBoundingClientRect();
  const overCanvas = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  if (!overCanvas) {
    drag.currentTileX = -1;
    drag.currentTileY = -1;
    drag.isValid = false;
    return;
  }
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const world = screenToWorld(cssX, cssY);
  const col = Math.floor(world.x / TILE_SIZE);
  const row = Math.floor(world.y / TILE_SIZE);
  const isOccupied = isDollAtTile(col, row, drag.id, drag.instanceId);
  const isValid = isValidMapPosition(col, row) && !isOccupied;
  drag.currentTileX = col;
  drag.currentTileY = row;
  drag.isValid = isValid;
}
function commitExternalDrop(tileX, tileY, id, instanceId) {
  const isOccupied = isDollAtTile(tileX, tileY, id, instanceId);
  const isValid = isValidMapPosition(tileX, tileY) && !isOccupied;
  if (isValid) {
    if (instanceId) {
      placeSummon(id, instanceId, tileX, tileY);
    } else {
      placeDoll(id, tileX, tileY);
    }
  }
}
function handleTouchStart(e) {
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) {
    activeTouches.set(t.identifier, {
      x: t.clientX,
      y: t.clientY
    });
  }
  if (activeTouches.size === 1 && !drag) {
    const [touch] = e.changedTouches;
    const rect = canvasEl.getBoundingClientRect();
    const world = screenToWorld(touch.clientX - rect.left, touch.clientY - rect.top);
    const hit = getObjectAtWorld(world.tileX, world.tileY);
    if (hit) {
      drag = hit;
    }
  }
  if (activeTouches.size === 2 && drag) {
    drag = null;
  }
  lastPinchDist = getPinchDist();
}
function handleTouchMove(e) {
  e.preventDefault();
  const count = activeTouches.size;
  if (count < 1 || count > 2) return;
  const prevTouches = new Map(activeTouches);
  for (const t of Array.from(e.changedTouches)) {
    if (activeTouches.has(t.identifier)) {
      activeTouches.set(t.identifier, {
        x: t.clientX,
        y: t.clientY
      });
    }
  }
  if (count === 1 && drag) {
    const [touch] = e.changedTouches;
    const rect = canvasEl.getBoundingClientRect();
    const world = screenToWorld(touch.clientX - rect.left, touch.clientY - rect.top);
    updateDrag(world.tileX, world.tileY);
    return;
  }
  if (count === 1) {
    const [id] = activeTouches.keys();
    const prev = prevTouches.get(id);
    const curr = activeTouches.get(id);
    camera.x -= (curr.x - prev.x) / camera.scale;
    camera.y -= (curr.y - prev.y) / camera.scale;
    clampCamera();
  } else {
    const [idA, idB] = activeTouches.keys();
    const currA = activeTouches.get(idA);
    const currB = activeTouches.get(idB);
    const prevA = prevTouches.get(idA);
    const prevB = prevTouches.get(idB);
    const prevMid = {
      x: (prevA.x + prevB.x) / 2,
      y: (prevA.y + prevB.y) / 2
    };
    const currMid = {
      x: (currA.x + currB.x) / 2,
      y: (currA.y + currB.y) / 2
    };
    camera.x -= (currMid.x - prevMid.x) / camera.scale;
    camera.y -= (currMid.y - prevMid.y) / camera.scale;
    const prevDist = Math.hypot(prevA.x - prevB.x, prevA.y - prevB.y);
    const currDist = Math.hypot(currA.x - currB.x, currA.y - currB.y);
    if (prevDist > 0) {
      zoomAt(currMid.x, currMid.y, currDist / prevDist);
    }
  }
}
function handleTouchEnd(e) {
  e.preventDefault();
  if (drag && activeTouches.size === 1) {
    endDrag();
  }
  for (const t of Array.from(e.changedTouches)) {
    activeTouches.delete(t.identifier);
  }
  lastPinchDist = getPinchDist();
}
function getPinchDist() {
  const pts = Array.from(activeTouches.values());
  if (pts.length !== 2) return null;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}
function isDollAtTile(tileX, tileY, id, instanceId) {
  const tab = state.tabData[state.currentTab];
  for (const [dollId, pos] of Object.entries(tab.dollPositions)) {
    if (pos.x === tileX && pos.y === tileY && dollId !== id) return true;
  }
  for (const summon of tab.summonPositions) {
    if (summon.x === tileX && summon.y === tileY && summon.id !== id && summon.mapId !== instanceId) return true;
  }
  return false;
}
function isValidMapPosition(tileX, tileY) {
  const cell = mapGrid[tileKey(tileX, tileY)];
  const isSetup = state.currentTab === 0;
  const isSpawnTile = cell && cell.spawn;
  const isBlocked = cell && (cell.cover === "boss" || cell.cover === "hcov" || cell.cover === "fcov");
  const inBounds = tileX >= 0 && tileX < MAP_SIZE && tileY >= 0 && tileY < MAP_SIZE;
  return inBounds && (isSetup && isSpawnTile || !isSetup && !isBlocked);
}
function updateDrag(tileX, tileY) {
  if (!drag) return;
  const isOccupied = isDollAtTile(tileX, tileY, drag.id, drag.instanceId);
  const isValid = isValidMapPosition(tileX, tileY) && !isOccupied;
  drag.currentTileX = tileX;
  drag.currentTileY = tileY;
  drag.isValid = isValid;
}
function endDrag() {
  if (!drag) return;
  if (drag.isValid) {
    commitDrop(drag.currentTileX, drag.currentTileY, drag.id, drag.instanceId);
  }
  drag = null;
}
function bindResize() {
  window.addEventListener("resize", () => fitToWindow());
  window.matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", () => fitToWindow());
}
function getWorldPos(clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const scaleRatio = CANVAS_SIZE / rect.width;
  const mx = (clientX - rect.left) * scaleRatio;
  const my = (clientY - rect.top) * scaleRatio;
  return {
    col: Math.floor((mx - offsetX()) / (TILE_SIZE * zoom())),
    row: Math.floor((my - offsetY()) / (TILE_SIZE * zoom()))
  };
}
function ArenaCanvas(props) {
  onMount(() => {
    ctx = canvasEl.getContext("2d");
    fitToWindow();
    bindResize();
    loop();
  });
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const world = screenToWorld(e.offsetX, e.offsetY);
    const hit = getObjectAtWorld(world.tileX, world.tileY);
    if (hit) {
      drag = hit;
    } else {
      isPanning = true;
      lastMouse = {
        x: e.clientX,
        y: e.clientY
      };
    }
  };
  const handleMouseMove = (e) => {
    const world = screenToWorld(e.offsetX, e.offsetY);
    props.onCoordsChange(`${String(world.tileX).padStart(2, "0")},${String(world.tileY).padStart(2, "0")}`);
    if (drag) {
      updateDrag(world.tileX, world.tileY);
    } else if (isPanning) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      camera.x -= dx / camera.scale;
      camera.y -= dy / camera.scale;
      clampCamera();
      lastMouse = {
        x: e.clientX,
        y: e.clientY
      };
    }
  };
  const handleMouseUp = () => {
    if (drag) {
      endDrag();
    }
    isPanning = false;
  };
  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomAt(e.offsetX, e.offsetY, factor);
  };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    const raw = e.dataTransfer?.getData("text/plain") ?? "";
    const pos = getWorldPos(e.clientX, e.clientY);
    if (raw.startsWith("summon:")) {
      const parts = raw.split(":");
      placeSummon(parts[1], parts[2], pos.col, pos.row);
    } else {
      const parts = raw.split(":");
      placeDoll(parts[1], pos.col, pos.row);
    }
  };
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (state.currentTab < 1 || state.currentTab > 7) return;
    const pos = getWorldPos(e.clientX, e.clientY);
    setState(produce((s) => {
      const summons = s.tabData[s.currentTab].summonPositions;
      for (let i = summons.length - 1; i >= 0; i--) {
        if (summons[i].x === pos.col && summons[i].y === pos.row) {
          summons.splice(i, 1);
          break;
        }
      }
    }));
    saveToLocalStorage();
  };
  return (() => {
    var _el$ = _tmpl$19();
    _el$.$$contextmenu = handleContextMenu;
    _el$.addEventListener("wheel", handleWheel);
    _el$.addEventListener("drop", handleDrop);
    _el$.addEventListener("dragover", handleDragOver);
    _el$.addEventListener("touchcancel", handleTouchEnd);
    _el$.$$touchend = handleTouchEnd;
    _el$.$$touchmove = handleTouchMove;
    _el$.$$touchstart = handleTouchStart;
    _el$.addEventListener("mouseleave", () => {
      isPanning = false;
      draggingCharId = null;
    });
    _el$.$$mouseup = handleMouseUp;
    _el$.$$mousemove = handleMouseMove;
    _el$.$$mousedown = handleMouseDown;
    var _ref$ = canvasEl;
    typeof _ref$ === "function" ? use(_ref$, _el$) : canvasEl = _el$;
    return _el$;
  })();
}
delegateEvents(["mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend", "contextmenu"]);

// src/components/modals/FullScreen.tsx
var _tmpl$20 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90">`);
function FullScreen(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$20();
    insert(_el$, resolved);
    return _el$;
  })();
}

// src/components/modals/Modal.tsx
var _tmpl$21 = /* @__PURE__ */ template(`<div class="mb-1.75 flex flex-col"><h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]"></h2><div class="mt-1.75 border-t-3 border-[#B5B5B6]">`);
var _tmpl$24 = /* @__PURE__ */ template(`<div><div class="flex h-full w-full flex-col overflow-hidden border-2 border-[#B1AFB3] px-1.5 py-1.75">`);
function Modal(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$24(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$3 = _tmpl$21(), _el$4 = _el$3.firstChild;
        insert(_el$4, () => props.title);
        return _el$3;
      }
    }), null);
    insert(_el$2, resolved, null);
    createRenderEffect(() => className(_el$, `${props.width ?? "w-225"} overflow-hidden rounded-sm border-4 border-[#CFCED2] bg-[#CFCED2] shadow-2xl`));
    return _el$;
  })();
}

// src/components/modals/ModalHeader.tsx
var _tmpl$25 = /* @__PURE__ */ template(`<div class="mb-1.75 flex flex-col"><h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]"></h2><div class="mt-1.75 border-t-3 border-[#B5B5B6]">`);
function ModalHeader(props) {
  return (() => {
    var _el$ = _tmpl$25(), _el$2 = _el$.firstChild;
    insert(_el$2, () => props.title);
    return _el$;
  })();
}

// src/components/modals/ModalFooter.tsx
var _tmpl$26 = /* @__PURE__ */ template(`<div class="flex flex-col"><div class="my-1.75 border-t-3 border-[#B5B5B6]"></div><div>`);
function ModalFooter(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$26(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    insert(_el$3, resolved);
    createRenderEffect(() => className(_el$3, `flex px-4 py-4 pt-2.25 ${props.styles}`));
    return _el$;
  })();
}

// src/components/modals/ConfirmModal.tsx
var _tmpl$27 = /* @__PURE__ */ template(`<div class="text-md justify-center text-center font-bold text-[#1C2A32]">`);
function ConfirmModal(props) {
  function getTextWidth(text) {
    var canvas = document.createElement("canvas");
    var context = canvas.getContext("2d");
    context.font = "bold 16px Roboto, sans-serif";
    var metrics = context.measureText(text);
    return `w-[${Math.floor(metrics.width)}px]`;
  }
  return createComponent(Portal, {
    get mount() {
      return props.mount;
    },
    get children() {
      return createComponent(Show, {
        get when() {
          return props.isActive();
        },
        fallback: null,
        get children() {
          return createComponent(FullScreen, {
            get children() {
              return createComponent(Modal, {
                get width() {
                  return getTextWidth(props.content);
                },
                get children() {
                  return [createComponent(ModalHeader, {
                    get title() {
                      return props.title ?? "Confirm";
                    }
                  }), (() => {
                    var _el$ = _tmpl$27();
                    insert(_el$, () => props.content);
                    return _el$;
                  })(), createComponent(ModalFooter, {
                    styles: "gap-4",
                    get children() {
                      return [createComponent(Button, {
                        onClick: () => props.setActive(false),
                        color: "dark",
                        design: "cancel"
                      }), createComponent(Button, {
                        onClick: () => {
                          props.setActive(false);
                          props.onClick();
                        },
                        color: "dark",
                        design: "confirm"
                      })];
                    }
                  })];
                }
              });
            }
          });
        }
      });
    }
  });
}

// src/components/SetupSidebar.tsx
var _tmpl$28 = /* @__PURE__ */ template(`<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Summons (drag to map)`);
var _tmpl$29 = /* @__PURE__ */ template(`<div class="flex flex-wrap gap-3">`);
var _tmpl$32 = /* @__PURE__ */ template(`<div><div class="flex flex-col items-center gap-3 pt-1 text-sm font-bold text-[#384B53]"><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Echelon (drag to map)</div><div class="flex flex-wrap gap-3"></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">State Management</div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#AE4749] font-bold tracking-wide text-[#ECECEC]">Danger Zone`);
function SetupSidebar(props) {
  const isActionTab = createMemo(() => state.currentTab >= 1 && state.currentTab <= 7);
  const availableSummonIds = createMemo(() => isActionTab() ? getSummonIdsFromDollIds(state.selectedDolls.map((d) => d.id)) : []);
  const [showClearSkillModal, setShowClearSkillModal] = createSignal(false);
  const [showClearTurnModal, setShowClearTurnModal] = createSignal(false);
  const [showClearDataModal, setShowClearDataModal] = createSignal(false);
  const openDollSelector = () => {
    setTempSelected(state.selectedDolls.map((d) => d.id));
    const nums = {};
    state.selectedDolls.forEach((d) => {
      nums[d.id] = d.fortification;
    });
    setDollFortification(nums);
    setActivePhaseTab("All");
    setShowDollModal(true);
  };
  const copyPreviousPlacements = () => {
    if (state.currentTab <= 0) {
      alert("No previous tab!");
      return;
    }
    const prev = state.currentTab - 1;
    setState(produce((s) => {
      const curTab = s.tabData[s.currentTab];
      const prevTab = s.tabData[prev];
      for (const doll of s.selectedDolls) {
        curTab.dollPositions[doll.id] = {
          x: -1,
          y: -1
        };
        prevTab.dollPositions[doll.id] = prevTab.dollPositions[doll.id] ?? {
          x: -1,
          y: -1
        };
        curTab.dollPositions[doll.id].x = prevTab.dollPositions[doll.id].x;
        curTab.dollPositions[doll.id].y = prevTab.dollPositions[doll.id].y;
      }
      curTab.summonPositions = prevTab.summonPositions.map((p) => ({
        ...p
      }));
    }));
    saveToLocalStorage();
  };
  const clearCurrentTurn = () => {
    if (state.currentTab === -1) {
      editorResetLayout();
      return;
    }
    setState(produce((s) => {
      const tab = s.tabData[s.currentTab];
      tab.actionOrder.length = 0;
      tab.summonPositions.length = 0;
      tab.dollPositions = {};
      tab.actions = {};
      for (const doll of s.selectedDolls) {
        tab.dollPositions[doll.id] = {
          x: -1,
          y: -1
        };
        tab.actions[doll.id] = [];
        const dollInfo = getDollFromId(doll.id);
        if (dollInfo && dollInfo?.hasSummons) {
          for (const summonId of dollInfo.summons) tab.actions[summonId] = [];
        }
      }
    }));
    defaultActionOrder(state.currentTab);
    saveToLocalStorage();
  };
  const clearSavedData = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };
  const clearSkills = () => {
    if (state.currentTab < 0 || state.currentTab > 7) return;
    setState(produce((s) => {
      const tab = s.tabData[s.currentTab];
      for (const dollId of Object.keys(tab.actions)) {
        tab.actions[dollId] = [];
      }
    }));
    saveToLocalStorage();
  };
  return (() => {
    var _el$ = _tmpl$32(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$7 = _el$4.nextSibling, _el$8 = _el$7.nextSibling;
    insert(_el$2, createComponent(Button, {
      color: "dark",
      onClick: openDollSelector,
      design: "custom",
      content: "Select Dolls"
    }), _el$3);
    insert(_el$2, createComponent(Show, {
      get when() {
        return isActionTab();
      },
      get children() {
        return createComponent(Button, {
          color: "dark",
          onClick: copyPreviousPlacements,
          design: "custom",
          content: "Use Prev Turn Positions"
        });
      }
    }), _el$3);
    insert(_el$4, createComponent(For, {
      get each() {
        return state.selectedDolls;
      },
      children: (doll) => {
        const dollInfo = getDollFromId(doll.id);
        if (!dollInfo) return null;
        return createComponent(SmallDollChip, {
          target: dollInfo,
          doll: dollInfo,
          onDragStart: (e) => e.preventDefault(),
          onMouseDown: (e) => {
            e.preventDefault();
            beginExternalDrag(doll.id, null, e);
          },
          onTouchStart: (e) => {
            e.preventDefault();
            beginExternalDrag(doll.id, null, e);
          }
        });
      }
    }));
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isActionTab())() && availableSummonIds().length > 0;
      },
      get children() {
        return [_tmpl$28(), (() => {
          var _el$6 = _tmpl$29();
          insert(_el$6, createComponent(For, {
            get each() {
              return availableSummonIds();
            },
            children: (summonId) => {
              const summonInfo = getSummonFromId(summonId);
              if (!summonInfo) return null;
              return createComponent(SmallDollChip, {
                target: summonInfo,
                get doll() {
                  return getDollFromSummon(summonInfo);
                },
                onDragStart: (e) => e.preventDefault(),
                onMouseDown: (e) => {
                  e.preventDefault();
                  beginExternalDrag(summonId, `s${state.tabData[state.currentTab].summonPositions.length}`, e);
                },
                onTouchStart: (e) => {
                  e.preventDefault();
                  beginExternalDrag(summonId, `s${state.tabData[state.currentTab].summonPositions.length}`, e);
                }
              });
            }
          }));
          return _el$6;
        })()];
      }
    }), _el$7);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowSkillDisplayModal(true),
      color: "dark",
      design: "custom",
      content: "Set Skill Display"
    }), _el$8);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowExportModal(true),
      color: "dark",
      design: "custom",
      content: "Export Transcript"
    }), _el$8);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowImportModal(true),
      color: "dark",
      design: "custom",
      content: "Import Transcript"
    }), _el$8);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowClearSkillModal(true),
      color: "red",
      design: "custom",
      content: "Clear Skills This Turn"
    }), null);
    insert(_el$2, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body");
      },
      title: "Caution",
      content: "Clear all skill usage for current turn?",
      isActive: showClearSkillModal,
      setActive: setShowClearSkillModal,
      onClick: clearSkills
    }), null);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowClearTurnModal(true),
      color: "red",
      design: "custom",
      content: "Clear This Entire Turn"
    }), null);
    insert(_el$2, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body");
      },
      title: "Caution",
      content: "Clear all skill usage and doll positions for current turn?",
      isActive: showClearTurnModal,
      setActive: setShowClearTurnModal,
      onClick: clearCurrentTurn
    }), null);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowClearDataModal(true),
      color: "red",
      design: "custom",
      content: "Clear All Turns"
    }), null);
    insert(_el$2, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body");
      },
      title: "Caution",
      content: "Clear all stored data for all turns?",
      isActive: showClearDataModal,
      setActive: setShowClearDataModal,
      onClick: clearSavedData
    }), null);
    createRenderEffect(() => className(_el$, `${props.active ? "" : "hidden"} overflow-y-auto`));
    return _el$;
  })();
}

// src/components/EditorView.tsx
var _tmpl$30 = /* @__PURE__ */ template(`<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3"><div class="flex-wrap gap-1 rounded-sm bg-[#CFCED2] p-1 text-sm font-bold text-[#325563] shadow-sm shadow-black/50"><div class="flex flex-row items-center gap-1.5 border-2 border-[#B1AFB3] p-1"><span class="etl whitespace-nowrap"></span><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><span class=etl>Tool:</span><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><span class="etl text-[#445566]">Boundary:</span><select class="rounded border border-[#1e2730] bg-[#0c1014] px-1.5 py-0.5 text-[#6a7e8e]"><option value=h>Horizontal</option><option value=v>Vertical</option></select><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Export JSON</button><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Import JSON</button></div></div><div class="flex-1 overflow-auto rounded-md"style=line-height:0><canvas style=display:block;cursor:crosshair></canvas></div><p class="mt-1 pl-0.5 text-[#2a3a4a]">`);
var _tmpl$210 = /* @__PURE__ */ template(`<button><span class="h-[11px] w-[11px] flex-shrink-0 rounded-[2px]">`);
var _tmpl$33 = /* @__PURE__ */ template(`<button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">`);
var _tmpl$42 = /* @__PURE__ */ template(`<div class="mt-2 flex-shrink-0 rounded-md border border-[#1e2730] bg-[#13181f] p-2"><textarea class="h-[120px] w-full resize-y rounded border border-[#1e2730] bg-[#0c1014] p-1.5 font-mono text-[11px] text-[#6a9a7a]"></textarea><div class="mt-1.5 flex gap-1.5"><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]"></button><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Close`);
var canvasEl2;
var ctx2;
var painting = false;
function editorRender() {
  if (!ctx2) return;
  ctx2.clearRect(0, 0, CANVAS_SIZE * SCALE, CANVAS_SIZE * SCALE);
  ctx2.save();
  ctx2.scale(SCALE, SCALE);
  drawMapTilesOnArena(ctx2, null, -1);
  ctx2.restore();
}
function editorHit(e) {
  const rect = canvasEl2.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
  const sy = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height);
  return {
    c: Math.floor((sx - E_PAD) / TILE_SIZE),
    r: Math.floor((sy - E_PAD) / TILE_SIZE)
  };
}
function applyTool(c, r, erase) {
  if (!inMapBounds(c, r)) return;
  const dir = boundaryDir();
  if (erase) {
    const cell = mapGrid[gridKey(c, r)];
    if (!cell) return;
    if (cell.cover === "boss" && cell.bossOrigin) {
      const [oc, or] = cell.bossOrigin;
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
        const bk = gridKey(oc + dc, or + dr);
        if (mapGrid[bk]) {
          mapGrid[bk].cover = null;
          mapGrid[bk].bossOrigin = null;
        }
      }
    } else if (cell.cover) {
      cell.cover = null;
    } else if (cell.bndH || cell.bndV) {
      cell.bndH = false;
      cell.bndV = false;
    } else {
      cell.spawn = false;
    }
    editorRender();
    return;
  }
  const tool = editorTool();
  if (tool === "boss") {
    if (c + 2 >= MAP_SIZE || r + 2 >= MAP_SIZE) return;
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) if (hasCover(c + dc, r + dr)) return;
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) {
      const cell = getCell(c + dc, r + dr);
      cell.cover = "boss";
      cell.bossOrigin = [c, r];
      cell.spawn = false;
      cell.bndH = false;
      cell.bndV = false;
    }
  } else if (tool === "hcov" || tool === "fcov") {
    const cell = getCell(c, r);
    cell.cover = tool;
    cell.spawn = false;
    cell.bndH = false;
    cell.bndV = false;
    cell.bossOrigin = null;
  } else if (tool === "spawn") {
    if (!hasCover(c, r)) getCell(c, r).spawn = true;
  } else if (tool === "hbnd") {
    if (dir === "h") {
      if (!inMapBounds(c, r + 1) || hasCover(c, r) || hasCover(c, r + 1)) return;
      getCell(c, r).bndH = true;
    } else {
      if (!inMapBounds(c + 1, r) || hasCover(c, r) || hasCover(c + 1, r)) return;
      getCell(c, r).bndV = true;
    }
  } else if (tool === "erase") {
    applyTool(c, r, true);
    return;
  }
  editorRender();
}
var TOOL_BUTTONS = [{
  tool: "spawn",
  label: "Spawn",
  color: "#0d2060",
  border: "#3060cc"
}, {
  tool: "hbnd",
  label: "Half boundary",
  color: "#2a2010",
  border: "#6a5020"
}, {
  tool: "hcov",
  label: "Half cover",
  color: "#1e3018",
  border: "#3a5830"
}, {
  tool: "fcov",
  label: "Full cover",
  color: "#2a1c0c",
  border: "#6a4020"
}, {
  tool: "boss",
  label: "Boss (3\xD73)",
  color: "#300a0a",
  border: "#882020"
}, {
  tool: "erase",
  label: "Erase",
  color: "#1a1a1a",
  border: "#333"
}];
function EditorView() {
  onMount(() => {
    canvasEl2.width = CANVAS_SIZE * SCALE;
    canvasEl2.height = CANVAS_SIZE * SCALE;
    ctx2 = canvasEl2.getContext("2d");
    loadEditorMap();
    editorRender();
    canvasEl2.addEventListener("mousedown", (e) => {
      e.preventDefault();
      painting = true;
      const h = editorHit(e);
      applyTool(h.c, h.r, e.button === 2);
    });
    canvasEl2.addEventListener("mousemove", (e) => {
      const pos = editorHit(e);
      if (pos.c < 0 || pos.r < 0) return;
      setEditorCoords(`${String(pos.r).padStart(2, "0")},${String(pos.c).padStart(2, "0")}`);
      if (!painting) return;
      applyTool(pos.c, pos.r, e.button === 2);
    });
    canvasEl2.addEventListener("mouseup", () => {
      painting = false;
      saveEditorMap();
    });
    canvasEl2.addEventListener("mouseleave", () => {
      painting = false;
    });
    canvasEl2.addEventListener("contextmenu", (e) => e.preventDefault());
  });
  const handleDoIO = () => {
    if (editorIoMode() === "export") {
      navigator.clipboard.writeText(editorIoText()).catch(() => {
      });
      setEditorStatus("Copied to clipboard");
    } else {
      try {
        editorDeserialize(editorIoText());
        setShowEditorIo(false);
        setEditorStatus("Map imported successfully");
        saveEditorMap();
        editorRender();
      } catch (e) {
        setEditorStatus("Import error: " + e.message);
      }
    }
  };
  return (() => {
    var _el$ = _tmpl$30(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling, _el$7 = _el$6.nextSibling, _el$8 = _el$7.nextSibling, _el$9 = _el$8.nextSibling, _el$0 = _el$9.nextSibling, _el$1 = _el$0.nextSibling, _el$10 = _el$1.nextSibling, _el$11 = _el$10.nextSibling, _el$12 = _el$2.nextSibling, _el$13 = _el$12.firstChild, _el$14 = _el$12.nextSibling;
    insert(_el$4, editorCoords);
    insert(_el$3, () => TOOL_BUTTONS.map(({
      tool,
      label,
      color,
      border
    }) => (() => {
      var _el$15 = _tmpl$210(), _el$16 = _el$15.firstChild;
      _el$15.$$click = () => setEditorTool(tool);
      setStyleProperty(_el$16, "background", color);
      setStyleProperty(_el$16, "border", `1px solid ${border}`);
      insert(_el$15, label, null);
      createRenderEffect(() => className(_el$15, `flex cursor-pointer items-center gap-1 rounded border px-2 py-1 whitespace-nowrap transition-colors ${editorTool() === tool ? "border-[#2060cc] bg-[#1C2A32] text-[#4a9aff]" : "border-[#1e2730] bg-[#1C2A32] text-[#6a7e8e] hover:border-[#2e4050] hover:text-[#9ab0c0]"}`));
      return _el$15;
    })()), _el$7);
    _el$9.addEventListener("change", (e) => setBoundaryDir(e.currentTarget.value));
    insert(_el$3, () => [{
      label: "Reset",
      onClick: () => {
        editorResetLayout();
        editorRender();
      }
    }, {
      label: "Clear",
      onClick: () => {
        editorClearAll();
        editorRender();
      }
    }].map(({
      label,
      onClick
    }) => (() => {
      var _el$17 = _tmpl$33();
      addEventListener(_el$17, "click", onClick, true);
      insert(_el$17, label);
      return _el$17;
    })()), _el$1);
    _el$10.$$click = () => {
      setEditorIoMode("export");
      setEditorIoText(editorSerialize());
      setShowEditorIo(true);
    };
    _el$11.$$click = () => {
      setEditorIoMode("import");
      setEditorIoText("");
      setShowEditorIo(true);
      setEditorStatus("Paste your JSON map data and click Load map");
    };
    var _ref$ = canvasEl2;
    typeof _ref$ === "function" ? use(_ref$, _el$13) : canvasEl2 = _el$13;
    insert(_el$14, editorStatus);
    insert(_el$, (() => {
      var _c$ = memo(() => !!showEditorIo());
      return () => _c$() && (() => {
        var _el$18 = _tmpl$42(), _el$19 = _el$18.firstChild, _el$20 = _el$19.nextSibling, _el$21 = _el$20.firstChild, _el$22 = _el$21.nextSibling;
        _el$19.$$input = (e) => setEditorIoText(e.currentTarget.value);
        setAttribute(_el$19, "spellcheck", false);
        _el$21.$$click = handleDoIO;
        insert(_el$21, () => editorIoMode() === "export" ? "Copy to clipboard" : "Load map");
        _el$22.$$click = () => setShowEditorIo(false);
        createRenderEffect(() => _el$19.value = editorIoText());
        return _el$18;
      })();
    })(), null);
    createRenderEffect(() => _el$9.value = boundaryDir());
    return _el$;
  })();
}
delegateEvents(["click", "input"]);

// src/components/icons/SkillIcon.tsx
var _tmpl$31 = /* @__PURE__ */ template(`<div class="skill-icon shrink-0 cursor-pointer"><img>`);
function SkillIcon(props) {
  return (() => {
    var _el$ = _tmpl$31(), _el$2 = _el$.firstChild;
    addEventListener(_el$, "click", props.onClick, true);
    createRenderEffect((_p$) => {
      var _v$ = props.skill.localImagePath, _v$2 = `h-10 w-10 rounded-sm border-2 border-[#717376] bg-black/70 object-cover outline-2 outline-transparent transition transition-discrete duration-175 ${props.onClick ? "hover:scale-107 hover:outline-white" : ""}`, _v$3 = props.skill.name;
      _v$ !== _p$.e && setAttribute(_el$2, "src", _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && setAttribute(_el$2, "title", _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/SquareDollChip.tsx
var _tmpl$34 = /* @__PURE__ */ template(`<div class="absolute top-0.5 left-0.5 h-4 w-4">`);
var _tmpl$211 = /* @__PURE__ */ template(`<div class="absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class="overflow-hidden overflow-ellipsis whitespace-nowrap">`);
var _tmpl$35 = /* @__PURE__ */ template(`<div><div class="relative flex justify-center overflow-hidden bg-[#909597]"><img loading=lazy>`, true, false, false);
var _tmpl$43 = /* @__PURE__ */ template(`<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">`);
function SquareDollChip(props) {
  const interactive = typeof props.onClick !== "undefined" || typeof props.onDragStart !== "undefined" || typeof props.onMouseDown !== "undefined" || typeof props.onTouchStart !== "undefined";
  return (() => {
    var _el$ = _tmpl$35(), _el$2 = _el$.firstChild, _el$4 = _el$2.firstChild;
    addEventListener(_el$, "touchstart", props.onTouchStart, true);
    addEventListener(_el$, "mousedown", props.onMouseDown, true);
    addEventListener(_el$, "dragstart", props.onDragStart);
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$7 = _tmpl$43();
        insert(_el$7, createComponent(Check, {}));
        return _el$7;
      })();
    })(), _el$4);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.icon;
      },
      get children() {
        var _el$3 = _tmpl$34();
        insert(_el$3, createComponent(PhaseIcon, {
          get phase() {
            return props.doll.phase;
          }
        }));
        return _el$3;
      }
    }), _el$4);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.name;
      },
      get children() {
        var _el$5 = _tmpl$211(), _el$6 = _el$5.firstChild;
        insert(_el$6, () => props.target.name);
        return _el$5;
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = props.draggable, _v$2 = props.style, _v$3 = `relative box-border flex ${props.size || "h-14 w-14"} flex-col overflow-hidden border-b-3 shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "cursor-pointer outline-3 hover:scale-107 hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"} ${props.doll.rarity === "Elite" ? "border-b-[#DF9E00]" : "border-b-[#7968BA]"} ${props.rounded ? "rounded-sm" : ""}`, _v$4 = props.target.avatar, _v$5 = `${props.size || "h-14 w-14"} object-cover object-top`;
      _v$ !== _p$.e && setAttribute(_el$, "draggable", _p$.e = _v$);
      _p$.t = style(_el$, _v$2, _p$.t);
      _v$3 !== _p$.a && className(_el$, _p$.a = _v$3);
      _v$4 !== _p$.o && setAttribute(_el$4, "src", _p$.o = _v$4);
      _v$5 !== _p$.i && className(_el$4, _p$.i = _v$5);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click", "mousedown", "touchstart"]);

// src/components/ActionSidebar.tsx
var _tmpl$36 = /* @__PURE__ */ template(`<button class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">Up`);
var _tmpl$212 = /* @__PURE__ */ template(`<button class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">Down`);
var _tmpl$37 = /* @__PURE__ */ template(`<div><div class="flex flex-col gap-1.5 border-2 border-[#D7D7D7] p-1"><div class="drag-grip flex items-center gap-2"><div class="flex flex-col gap-0.5"></div><div class="min-w-0 flex-1"><div class="mt-1 flex flex-wrap gap-1"></div></div></div><div class="flex flex-wrap gap-1.5">`);
var _tmpl$44 = /* @__PURE__ */ template(`<div class="group relative"><div class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 hover:bg-red-900 hover:text-red-300"title=Remove>`);
var _tmpl$52 = /* @__PURE__ */ template(`<div>`);
var draggableItem = null;
var listContainer = void 0;
var pointerStartX = 0;
var pointerStartY = 0;
var itemsGap = 0;
var items = [];
var prevRect = null;
function getAllItems() {
  if (!items.length && listContainer) {
    items = Array.from(listContainer.querySelectorAll(".doll-row"));
  }
  return items;
}
function getIdleItems() {
  return getAllItems().filter((item) => item.classList.contains("is-idle"));
}
function isItemAbove(item) {
  return item.hasAttribute("data-is-above");
}
function isItemToggled(item) {
  return item.hasAttribute("data-is-toggled");
}
function setItemsGap() {
  if (getIdleItems().length <= 1) {
    itemsGap = 0;
    return;
  }
  const item1 = getIdleItems()[0];
  const item2 = getIdleItems()[1];
  const item1Rect = item1.getBoundingClientRect();
  const item2Rect = item2.getBoundingClientRect();
  itemsGap = Math.abs(item1Rect.bottom - item2Rect.top);
}
function disablePageScroll() {
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
  document.body.style.userSelect = "none";
}
function initItemsState() {
  getIdleItems().forEach((item, i) => {
    if (draggableItem instanceof HTMLElement) {
      if (getAllItems().indexOf(draggableItem) > i) {
        item.dataset.isAbove = "";
      }
    }
  });
}
function initDraggableItem() {
  if (!draggableItem) return;
  draggableItem.classList.remove("is-idle");
  draggableItem.classList.add("is-draggable");
}
function drag2(e) {
  if (!draggableItem) return;
  e.preventDefault();
  let clientX = 0;
  let clientY = 0;
  if (e instanceof MouseEvent) {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  if (e instanceof TouchEvent) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  }
  const pointerOffsetX = clientX - pointerStartX;
  const pointerOffsetY = clientY - pointerStartY;
  draggableItem.style.transform = `translate(${pointerOffsetX}px, ${pointerOffsetY}px)`;
  updateIdleItemsStateAndPosition();
}
function updateIdleItemsStateAndPosition() {
  if (!draggableItem) return;
  const draggableItemRect = draggableItem.getBoundingClientRect();
  const draggableItemY = draggableItemRect.top + draggableItemRect.height / 2;
  getIdleItems().forEach((item) => {
    const itemRect = item.getBoundingClientRect();
    const itemY = itemRect.top + itemRect.height / 2;
    if (isItemAbove(item)) {
      if (draggableItemY <= itemY) {
        item.dataset.isToggled = "true";
      } else {
        delete item.dataset.isToggled;
      }
    } else {
      if (draggableItemY >= itemY) {
        item.dataset.isToggled = "true";
      } else {
        delete item.dataset.isToggled;
      }
    }
  });
  getIdleItems().forEach((item) => {
    if (isItemToggled(item)) {
      const direction = isItemAbove(item) ? 1 : -1;
      item.style.transform = `translateY(${direction * (draggableItemRect.height + itemsGap)}px)`;
    } else {
      item.style.transform = "";
    }
  });
}
function applyNewItemsOrder(e) {
  if (!draggableItem || !listContainer) return;
  const reorderedItems = [];
  getAllItems().forEach((item, index) => {
    if (item === draggableItem) {
      return;
    }
    if (!isItemToggled(item)) {
      reorderedItems[index] = item;
      return;
    }
    const newIndex = isItemAbove(item) ? index + 1 : index - 1;
    reorderedItems[newIndex] = item;
  });
  for (let index = 0; index < getAllItems().length; index++) {
    const item = reorderedItems[index];
    if (typeof item === "undefined") {
      reorderedItems[index] = draggableItem;
    }
  }
  setState(produce((s) => {
    const tab = s.tabData[s.currentTab];
    tab.actionOrder.length = 0;
    for (const item of reorderedItems) {
      tab.actionOrder.push(item.dataset.dollId);
    }
  }));
  saveToLocalStorage();
  reorderedItems.forEach((item) => {
    listContainer.appendChild(item);
  });
  draggableItem.style.transform = "";
  requestAnimationFrame(() => {
    if (draggableItem instanceof HTMLElement && prevRect instanceof DOMRect) {
      const rect = draggableItem.getBoundingClientRect();
      const yDiff = prevRect.y - rect.y;
      let currentPositionX = 0;
      let currentPositionY = 0;
      if (e instanceof MouseEvent) {
        currentPositionX = e.clientX;
        currentPositionY = e.clientY;
      }
      if (e instanceof TouchEvent) {
        currentPositionX = e.touches[0].clientX;
        currentPositionY = e.touches[0].clientY;
      }
      const pointerOffsetX = currentPositionX - pointerStartX;
      const pointerOffsetY = currentPositionY - pointerStartY;
      draggableItem.style.transform = `translate(${pointerOffsetX}px, ${pointerOffsetY + yDiff}px)`;
    }
    requestAnimationFrame(() => {
      unsetDraggableItem();
    });
  });
}
function cleanup() {
  itemsGap = 0;
  items = [];
  unsetItemState();
  enablePageScroll();
  defaultActionOrder(state.currentTab);
  document.removeEventListener("mousemove", drag2);
  document.removeEventListener("touchmove", drag2);
}
function unsetDraggableItem() {
  if (!draggableItem) return;
  draggableItem.style = "";
  draggableItem.classList.remove("is-draggable");
  draggableItem.classList.add("is-idle");
  draggableItem = null;
}
function unsetItemState() {
  getIdleItems().forEach((item, i) => {
    delete item.dataset.isAbove;
    delete item.dataset.isToggled;
    item.style.transform = "";
  });
}
function enablePageScroll() {
  document.body.style.overflow = "";
  document.body.style.touchAction = "";
  document.body.style.userSelect = "";
}
function handleSkillClick(dollId, sortedIdx) {
  if (!isPlaced(dollId)) {
    alert("Place doll first!");
    return;
  }
  const doll = getInfoFromId(dollId);
  if (!doll) return;
  const sorted = getSortedUsableSkills(doll);
  const skill = sorted[sortedIdx];
  if (!skill) return;
  const hasActiveBuff = skill.range !== "Self" && skill.range !== null && skill.name !== "Absolute Mental Defense" && skill.name !== "Honor Guard" && skill.tags && (skill.tags.includes("Healing") || skill.tags.includes("Buff")) && !skill.tags.includes("Targeted") && !skill.tags.includes("Tile");
  if (hasActiveBuff || skill.name === "Light of Bond" || skill.name === "Bad Influence") {
    setTargetDollId(dollId);
    setTargetSkillId(skill.id);
    setShowTargetModal(true);
  } else {
    recordSkill(dollId, [skill.id]);
  }
}
function recordSkill(dollId, entry) {
  if (state.currentTab < 0 || state.currentTab > 7) return;
  setState(produce((s) => {
    const tab = s.tabData[s.currentTab];
    if (!tab.actions[dollId]) tab.actions[dollId] = [];
    tab.actions[dollId].push(entry);
  }));
  saveToLocalStorage();
}
function removeAction(dollId, actionIdx) {
  console.log("removeAction", dollId, actionIdx, state.tabData[state.currentTab].actions[dollId]);
  setState(produce((s) => {
    s.tabData[s.currentTab].actions[dollId]?.splice(actionIdx, 1);
  }));
  saveToLocalStorage();
}
function DollRow(props) {
  const dollInfo = getInfoFromId(props.dollId);
  const placed = createMemo(() => isPlaced(props.dollId));
  const actions = createMemo(() => state.tabData[state.currentTab]?.actions[props.dollId] ?? []);
  const skills = dollInfo ? getSortedUsableSkills(dollInfo) : [];
  return (() => {
    var _el$ = _tmpl$37(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$7 = _el$4.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$3.nextSibling;
    insert(_el$4, createComponent(Show, {
      get when() {
        return state.tabData[state.currentTab]?.actionOrder?.indexOf(props.dollId) !== 0;
      },
      get children() {
        var _el$5 = _tmpl$36();
        _el$5.$$click = () => {
          setState(produce((s) => {
            const tab = s.tabData[s.currentTab];
            const index = tab.actionOrder.indexOf(props.dollId);
            const targetIndex = index - 1;
            const targetDollId2 = tab.actionOrder[targetIndex];
            tab.actionOrder[index] = targetDollId2;
            tab.actionOrder[targetIndex] = props.dollId;
          }));
          saveToLocalStorage();
        };
        return _el$5;
      }
    }), null);
    insert(_el$4, createComponent(Show, {
      get when() {
        return state.tabData[state.currentTab]?.actionOrder?.indexOf(props.dollId) !== state.tabData[state.currentTab]?.actionOrder?.length - 1;
      },
      get children() {
        var _el$6 = _tmpl$212();
        _el$6.$$click = () => {
          setState(produce((s) => {
            const tab = s.tabData[s.currentTab];
            const index = tab.actionOrder.indexOf(props.dollId);
            const targetIndex = index + 1;
            const targetDollId2 = tab.actionOrder[targetIndex];
            tab.actionOrder[index] = targetDollId2;
            tab.actionOrder[targetIndex] = props.dollId;
          }));
          saveToLocalStorage();
        };
        return _el$6;
      }
    }), null);
    insert(_el$3, createComponent(SquareDollChip, {
      target: dollInfo,
      get doll() {
        return getDollFromSummon(dollInfo);
      },
      icon: true,
      name: true
    }), _el$7);
    insert(_el$8, createComponent(For, {
      get each() {
        return actions();
      },
      children: (action, ai) => (() => {
        var _el$0 = _tmpl$44(), _el$1 = _el$0.firstChild;
        _el$1.$$click = () => {
          removeAction(props.dollId, ai());
        };
        insert(_el$1, () => renderAction(props.dollId, action));
        createRenderEffect(() => setAttribute(_el$1, "data-action-idx", ai()));
        return _el$0;
      })()
    }));
    insert(_el$9, createComponent(For, {
      each: skills,
      children: (skill, idx) => createComponent(SkillIcon, {
        skill,
        onClick: () => handleSkillClick(props.dollId, idx())
      })
    }));
    createRenderEffect((_p$) => {
      var _v$ = `doll-row is-idle rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50 ${placed() ? "border-lime-400/40" : "border-zinc-700"}`, _v$2 = props.dollId;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "data-doll-id", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function ActionSidebar(props) {
  const actionOrder = createMemo(() => {
    console.log("actionOrder", state.currentTab, state.tabData[state.currentTab]);
    if (state.currentTab < 0 || state.currentTab > 7) return [];
    return state.tabData[state.currentTab]?.actionOrder ?? [];
  });
  const handleDragStart = (e) => {
    return;
    if (e.target instanceof HTMLElement === false) return;
    if (e.target.classList.contains("drag-ignore") || e.target.closest(".drag-ignore")) return;
    if (e.target.classList.contains("drag-grip") || e.target.closest(".drag-grip")) {
      draggableItem = e.target.closest(".doll-row");
    }
    if (!draggableItem) return;
    if (e instanceof MouseEvent) {
      pointerStartX = e.clientX;
      pointerStartY = e.clientY;
    }
    if (e instanceof TouchEvent) {
      pointerStartX = e.touches[0].clientX;
      pointerStartY = e.touches[0].clientY;
    }
    setItemsGap();
    disablePageScroll();
    initDraggableItem();
    initItemsState();
    prevRect = draggableItem.getBoundingClientRect();
    document.addEventListener("mousemove", drag2);
    document.addEventListener("touchmove", drag2, {
      passive: false
    });
  };
  const handleDragEnd = (e) => {
    return;
    if (!draggableItem) return;
    applyNewItemsOrder(e);
    cleanup();
  };
  return (() => {
    var _el$10 = _tmpl$52();
    _el$10.$$touchend = handleDragEnd;
    _el$10.$$mouseup = handleDragEnd;
    _el$10.$$touchstart = handleDragStart;
    _el$10.$$mousedown = handleDragStart;
    var _ref$ = listContainer;
    typeof _ref$ === "function" ? use(_ref$, _el$10) : listContainer = _el$10;
    insert(_el$10, createComponent(For, {
      get each() {
        return actionOrder();
      },
      children: (dollId, i) => createComponent(DollRow, {
        dollId,
        get index() {
          return i();
        }
      })
    }));
    createRenderEffect(() => className(_el$10, `flex flex-col gap-1.5 overflow-y-auto p-1 ${props.active ? "" : "hidden"}`));
    return _el$10;
  })();
}
delegateEvents(["click", "mousedown", "touchstart", "mouseup", "touchend"]);

// src/components/icons/Fortification.tsx
var _tmpl$38 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 40 40"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-5,-5)><g transform=matrix(1.5,0,0,1.5,-22.25,-20.75)><circle cx=31.5 cy=30.5 r=6 style=fill:rgb(77,131,152)></circle></g><g transform=matrix(2.03293,-2.03293,2.32335,2.32335,-82.455,23.2575)><path d="M30,20L30,27L22,27L22,20L30,20ZM28.828,21.025C27.267,19.659 24.733,19.659 23.172,21.025C21.611,22.391 21.611,24.609 23.172,25.975C24.733,27.341 27.267,27.341 28.828,25.975C30.389,24.609 30.389,22.391 28.828,21.025Z"style=fill:rgb(201,200,204);fill-opacity:0.5></path></g><g transform=matrix(2.03846,0,0,2.03846,-39.2115,-37.1731)><path d="M26.186,34.242C25.439,33.183 25,31.893 25,30.5C25,29.009 25.503,27.635 26.348,26.538L25.348,24.871C25.257,24.721 25.281,24.529 25.405,24.405C25.529,24.281 25.721,24.257 25.871,24.348L27.538,25.348C28.635,24.503 30.009,24 31.5,24C32.991,24 34.365,24.503 35.462,25.348L37.129,24.348C37.279,24.257 37.471,24.281 37.595,24.405C37.719,24.529 37.743,24.721 37.652,24.871L36.652,26.538C37.497,27.635 38,29.009 38,30.5C38,31.893 37.561,33.183 36.814,34.242L37.652,35.638C37.743,35.789 37.719,35.981 37.595,36.105C37.471,36.228 37.279,36.252 37.129,36.162L35.806,35.368C34.659,36.383 33.151,37 31.5,37C29.849,37 28.341,36.383 27.194,35.368L25.871,36.162C25.721,36.252 25.529,36.228 25.405,36.105C25.281,35.981 25.257,35.789 25.348,35.638L26.186,34.242ZM31.5,24.858C28.386,24.858 25.858,27.386 25.858,30.5C25.858,33.614 28.386,36.142 31.5,36.142C34.614,36.142 37.142,33.614 37.142,30.5C37.142,27.386 34.614,24.858 31.5,24.858Z"style=fill:rgb(201,200,204)>`);
function Fortification() {
  return _tmpl$38();
}

// src/components/SummaryView.tsx
var _tmpl$39 = /* @__PURE__ */ template(`<div class="flex flex-row gap-2"><div style="width:430px;height:430px;flex-shrink:0;overflow:hidden;border-right:1px solid #3f3f46"></div><div class="flex min-w-0 grow flex-col gap-1 overflow-y-auto">`);
var _tmpl$213 = /* @__PURE__ */ template(`<div class="flex flex-col items-start gap-1 rounded-xs border-b-2 bg-[#F4F4F6] p-1 shadow-sm shadow-black/30"><div class="flex flex-row items-center gap-1"><div class="font-bold text-[#325563]"></div></div><div class="min-w-0 flex-1"><div class="flex flex-wrap gap-1">`);
var _tmpl$310 = /* @__PURE__ */ template(`<span class="rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50">`);
var _tmpl$45 = /* @__PURE__ */ template(`<div class="pt-1 text-sm text-zinc-600">No actions recorded`);
var _tmpl$53 = /* @__PURE__ */ template(`<div class="flex flex-col gap-1">`);
var _tmpl$62 = /* @__PURE__ */ template(`<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3"><div class="rounded-sm bg-[#CFCED2] p-1 shadow-sm shadow-black/50"><div class="flex flex-row gap-1.5 border-2 border-[#B1AFB3] p-1"></div></div><div class="min-[1860px]:grid min-[1860px]:grid-cols-3 flex flex-row flex-wrap gap-2">`);
var _tmpl$72 = /* @__PURE__ */ template(`<div class="rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50"><div class="flex flex-row items-center gap-3 border-2 border-[#D7D7D7] p-1"><div class="relative h-12 w-12"><div class="absolute z-10"></div><div class="absolute z-20 flex h-full w-full items-center justify-center text-[18px] font-bold">`);
function renderTabCanvas(tabIndex) {
  console.log("Rendering tab", tabIndex);
  const placedEntities = [];
  const placedDollPositions = [];
  state.selectedDolls.forEach((doll) => {
    const pos = state.tabData[tabIndex]?.dollPositions[doll.id] ?? {
      x: -1,
      y: -1
    };
    if (pos.x === -1 || pos.y === -1) return;
    placedDollPositions.push({
      pos,
      doll
    });
    placedEntities.push(pos);
  });
  for (const pos of state.tabData[tabIndex]?.summonPositions ?? []) {
    placedEntities.push(pos);
  }
  let bMinC = Infinity, bMaxC = -Infinity, bMinR = Infinity, bMaxR = -Infinity;
  for (const pos of placedEntities) {
    if (pos.x < bMinC) bMinC = pos.x;
    if (pos.x > bMaxC) bMaxC = pos.x;
    if (pos.y < bMinR) bMinR = pos.y;
    if (pos.y > bMaxR) bMaxR = pos.y;
  }
  for (const k in mapGrid) {
    const cell = mapGrid[k];
    if (!cell || cell.cover !== "boss") continue;
    const [tc, tr] = k.split(",").map(Number);
    if (tc < bMinC) bMinC = tc;
    if (tc > bMaxC) bMaxC = tc;
    if (tr < bMinR) bMinR = tr;
    if (tr > bMaxR) bMaxR = tr;
  }
  if (!isFinite(bMinC)) {
    bMinC = 0;
    bMaxC = MAP_SIZE - 1;
    bMinR = 0;
    bMaxR = MAP_SIZE - 1;
  }
  bMinC -= 1;
  bMaxC += 1;
  bMinR -= 1;
  bMaxR += 1;
  const spanC = bMaxC - bMinC + 1;
  const spanR = bMaxR - bMinR + 1;
  const span = Math.max(spanC, spanR, 9);
  const cCtr = (bMinC + bMaxC + 1) / 2;
  const rCtr = (bMinR + bMaxR + 1) / 2;
  const OUTPUT_SIZE = span * Math.ceil(429 / span);
  const tileSize = OUTPUT_SIZE / span;
  const sqC0 = cCtr - span / 2;
  const sqR0 = rCtr - span / 2;
  const tileC0 = Math.floor(sqC0);
  const tileR0 = Math.floor(sqR0);
  const subPxX = Math.round((sqC0 - tileC0) * tileSize);
  const subPxY = Math.round((sqR0 - tileR0) * tileSize);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  canvas.style.cssText = `display:block;width:${OUTPUT_SIZE}px;height:${OUTPUT_SIZE}px;flex-shrink:0;`;
  const ctx3 = canvas.getContext("2d");
  ctx3.save();
  ctx3.translate(-subPxX, -subPxY);
  ctx3.scale(tileSize / TILE_SIZE, tileSize / TILE_SIZE);
  ctx3.translate(-tileC0 * TILE_SIZE, -tileR0 * TILE_SIZE);
  ctx3.fillStyle = "#18181b";
  ctx3.fillRect((tileC0 - 2) * TILE_SIZE, (tileR0 - 2) * TILE_SIZE, (span + 4) * TILE_SIZE, (span + 4) * TILE_SIZE);
  drawMapTilesOnArena(ctx3, null, tabIndex);
  ctx3.restore();
  ctx3.font = `bold 16px Roboto, sans-serif`;
  ctx3.textAlign = "center";
  ctx3.textBaseline = "top";
  const labelW = Math.ceil(ctx3.measureText("Turn " + tabIndex).width) + 6;
  ctx3.fillStyle = "rgba(0,0,0,0.65)";
  ctx3.fillRect(12, 17, labelW, 20);
  ctx3.fillStyle = "#2dd4bf";
  ctx3.fillText("Turn " + tabIndex, 40, 20);
  return canvas;
}
function TabCard(props) {
  let canvasWrapRef;
  onMount(() => {
    const canvas = renderTabCanvas(props.tabIndex);
    canvasWrapRef.appendChild(canvas);
  });
  const tabLabel = () => props.tabIndex === 0 ? "Setup" : `Turn ${props.tabIndex}`;
  const actionOrder = createMemo(() => state.tabData[props.tabIndex]?.actionOrder ?? []);
  const hasActions = createMemo(() => {
    if (props.tabIndex === 0) return false;
    return state.selectedDolls.some((d) => (state.tabData[props.tabIndex]?.actions[d.id]?.length ?? 0) > 0);
  });
  return createComponent(Modal, {
    width: "min-w-151 grow",
    get children() {
      var _el$ = _tmpl$39(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
      var _ref$ = canvasWrapRef;
      typeof _ref$ === "function" ? use(_ref$, _el$2) : canvasWrapRef = _el$2;
      insert(_el$3, (() => {
        var _c$ = memo(() => !!hasActions());
        return () => _c$() ? createComponent(For, {
          get each() {
            return actionOrder();
          },
          children: (dollId) => {
            const actions = createMemo(() => state.tabData[props.tabIndex]?.actions[dollId] ?? []);
            if (!actions().length) return null;
            const doll = getInfoFromId(dollId);
            const fort = createMemo(() => getFortificationFromId(dollId));
            return (() => {
              var _el$4 = _tmpl$213(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild;
              insert(_el$5, createComponent(SquareDollChip, {
                target: doll,
                get doll() {
                  return getDollFromSummon(doll);
                },
                size: "h-10 w-10",
                icon: false,
                name: false
              }), _el$6);
              insert(_el$6, () => doll?.name);
              insert(_el$8, createComponent(For, {
                get each() {
                  return actions();
                },
                children: (a) => (() => {
                  var _el$9 = _tmpl$310();
                  insert(_el$9, () => renderAction(dollId, a));
                  return _el$9;
                })()
              }));
              return _el$4;
            })();
          }
        }) : _tmpl$45();
      })());
      return _el$;
    }
  });
}
function SummaryView() {
  return (() => {
    var _el$1 = _tmpl$62(), _el$10 = _el$1.firstChild, _el$11 = _el$10.firstChild, _el$12 = _el$10.nextSibling;
    insert(_el$11, createComponent(Button, {
      onClick: () => setShowExportModal(true),
      color: "dark",
      design: "custom",
      content: "Export Transcript"
    }), null);
    insert(_el$11, createComponent(Button, {
      onClick: () => setShowImportModal(true),
      color: "dark",
      design: "custom",
      content: "Import Transcript"
    }), null);
    insert(_el$11, createComponent(Button, {
      onClick: () => setShowSkillDisplayModal(true),
      color: "dark",
      design: "custom",
      content: "Set Skill Display"
    }), null);
    insert(_el$12, createComponent(Modal, {
      width: "min-w-151 grow",
      get children() {
        var _el$13 = _tmpl$53();
        insert(_el$13, createComponent(For, {
          get each() {
            return state.selectedDolls;
          },
          children: (doll) => {
            const dollInfo = getInfoFromId(doll.id);
            return (() => {
              var _el$14 = _tmpl$72(), _el$15 = _el$14.firstChild, _el$16 = _el$15.firstChild, _el$17 = _el$16.firstChild, _el$18 = _el$17.nextSibling;
              insert(_el$15, createComponent(SmallDollChip, {
                target: dollInfo,
                get doll() {
                  return getDollFromSummon(dollInfo);
                }
              }), _el$16);
              insert(_el$17, createComponent(Fortification, {}));
              insert(_el$18, () => doll.fortification || "\u2014");
              return _el$14;
            })();
          }
        }));
        return _el$13;
      }
    }), null);
    insert(_el$12, createComponent(For, {
      get each() {
        return Array.from({
          length: 8
        }, (_, i) => i);
      },
      children: (i) => createComponent(TabCard, {
        tabIndex: i
      })
    }), null);
    return _el$1;
  })();
}

// src/types/index.ts
var PHASE_TABS = ["All", "Physical", "Burn", "Electric", "Freeze", "Corrosion", "Hydro"];

// src/components/icons/All.tsx
var _tmpl$40 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=All><g transform=matrix(1.70115,-3.86259e-32,0,1.70115,-40.1313,-31.7244)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.70115,-3.86259e-32,0,1.70115,-40.1313,-72.7244)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.04166e-16,-1.70115,1.70115,1.04166e-16,-31.7244,120.131)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.04166e-16,-1.70115,1.70115,1.04166e-16,-72.7244,120.131)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z>`);
function All(props) {
  return (() => {
    var _el$ = _tmpl$40(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$3.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild;
    createRenderEffect((_p$) => {
      var _v$ = `fill:${props.fill ?? "white"};`, _v$2 = `fill:${props.fill ?? "white"};`, _v$3 = `fill:${props.fill ?? "white"};`, _v$4 = `fill:${props.fill ?? "white"};`;
      _p$.e = style(_el$4, _v$, _p$.e);
      _p$.t = style(_el$6, _v$2, _p$.t);
      _p$.a = style(_el$8, _v$3, _p$.a);
      _p$.o = style(_el$0, _v$4, _p$.o);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    return _el$;
  })();
}

// src/components/icons/Burn.tsx
var _tmpl$41 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.58211,0,0,1.96189,-23.2842,-43.7583)><g id=Burn><path id=standalone1 serif:id=standalone d="M33.696,61.874C31.412,61.39 29.373,60.638 27.611,59.665C22.976,56.825 20,52.43 20,47.5C20,47.378 20.002,47.257 20.005,47.136L20,47.136C20.022,42.298 22.463,38.039 26.151,35.553L26.151,36.321L26.166,36.31L26.166,37.225C25.873,37.711 25.714,38.242 25.714,38.757C25.714,40.416 27.471,41.785 29.902,41.762C33.055,41.733 34.559,39.775 34.559,38.116C34.559,37.807 34.477,37.514 34.329,37.243L34.329,37.22C33.787,36.034 33.512,34.557 33.601,32.742C33.61,32.568 33.628,32.393 33.655,32.218L33.642,32.218C33.659,32.141 33.676,32.065 33.695,31.989C34.345,28.673 38.109,25.149 42.496,23.457C42.63,23.406 42.763,23.361 42.896,23.324C42.899,24.148 42.948,25.064 42.948,26.042C42.948,27.27 44.643,31.18 49.318,33.784C55.668,36.382 60,41.552 60,47.5C60,52.559 56.866,57.055 52.023,59.884C50.109,60.883 47.884,61.627 45.381,62.062C49.032,60.428 51.791,57.425 51.791,54.64C51.791,52.663 51.135,51.019 50.053,49.758L50.084,49.702L49.898,49.584C49.242,48.868 48.444,48.283 47.549,47.841C44.734,45.506 41.84,42.273 41.84,40.492C41.84,40.298 41.852,40.109 41.875,39.925C40.472,41.233 39.564,43.317 39.564,45.663C39.564,46.699 39.741,47.684 40.06,48.574C40.067,48.687 40.07,48.801 40.07,48.916C40.07,51.609 38.273,53.796 36.06,53.796C34.221,53.796 32.669,52.285 32.198,50.228C30.435,51.815 29.351,53.856 29.351,55.835C29.351,58.332 31.066,60.524 33.696,61.874Z">`);
function Burn(props) {
  return (() => {
    var _el$ = _tmpl$41(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(228,102,41)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Corrosion.tsx
var _tmpl$46 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.74713,0,0,1.74713,-30.3218,-30.7586)><g id=Corrosion><g id=standalone1 serif:id=standalone><g transform=matrix(1.11111,0,0,1.25,-5.38889,-15.5)><ellipse cx=39.5 cy=58 rx=4.5 ry=4></ellipse></g><g transform=matrix(1.06667,0,0,1.23077,-4.13333,-11.2308)><ellipse cx=54.5 cy=46.5 rx=7.5 ry=6.5></ellipse></g><g transform=matrix(1.18182,0,0,1,-10.5455,1)><ellipse cx=52.5 cy=24.5 rx=5.5 ry=6.5></ellipse></g><g transform=matrix(0.884615,0,0,1.21053,4.34615,-7.68421)><ellipse cx=29 cy=36.5 rx=13 ry=9.5>`);
function Corrosion(props) {
  return (() => {
    var _el$ = _tmpl$46(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild;
    createRenderEffect((_p$) => {
      var _v$ = `fill:${props.fill ?? "rgb(134,121,232)"};`, _v$2 = `fill:${props.fill ?? "rgb(134,121,232)"};`, _v$3 = `fill:${props.fill ?? "rgb(134,121,232)"};`, _v$4 = `fill:${props.fill ?? "rgb(134,121,232)"};`;
      _p$.e = style(_el$6, _v$, _p$.e);
      _p$.t = style(_el$8, _v$2, _p$.t);
      _p$.a = style(_el$0, _v$3, _p$.a);
      _p$.o = style(_el$10, _v$4, _p$.o);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    return _el$;
  })();
}

// src/components/icons/Electric.tsx
var _tmpl$47 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.63441,0,0,1.63441,-27.828,-26.6022)><g id=Electric><path id=standalone1 serif:id=standalone d=M50,17.5L33,17.5L25,46L42,42L34,64L58,33L40,36L50,17.5Z>`);
function Electric(props) {
  return (() => {
    var _el$ = _tmpl$47(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(235,191,33)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Freeze.tsx
var _tmpl$48 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.58333,0,0,1.58333,-23.1721,-23.3333)><g id=Freeze><g id=standalone1 serif:id=standalone><g transform=matrix(1,0,0,1.2,-2,-12.8)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(1,0,0,1.2,-2,-36.8)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(0.961538,0,0,1.13636,-0.865385,-6.02273)><ellipse cx=42.5 cy=40.5 rx=6.5 ry=5.5></ellipse></g><g transform=matrix(0.499153,0.866514,-1.03982,0.598984,85.5838,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(-0.499989,0.866032,-1.03924,-0.599987,127.511,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(-0.499153,0.866514,1.03982,0.598984,-5.78748,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(0.499989,0.866032,1.03924,-0.599987,-47.7144,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z>`);
function Freeze(props) {
  return (() => {
    var _el$ = _tmpl$48(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$1.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$11.nextSibling, _el$14 = _el$13.firstChild, _el$15 = _el$13.nextSibling, _el$16 = _el$15.firstChild;
    createRenderEffect((_p$) => {
      var _v$ = `fill:${props.fill ?? "rgb(66,204,224)"};`, _v$2 = `fill:${props.fill ?? "rgb(66,204,224)"};`, _v$3 = `fill:${props.fill ?? "rgb(66,204,224)"};`, _v$4 = `fill:${props.fill ?? "rgb(66,204,224)"};`, _v$5 = `fill:${props.fill ?? "rgb(66,204,224)"};`, _v$6 = `fill:${props.fill ?? "rgb(66,204,224)"};`, _v$7 = `fill:${props.fill ?? "rgb(66,204,224)"};`;
      _p$.e = style(_el$6, _v$, _p$.e);
      _p$.t = style(_el$8, _v$2, _p$.t);
      _p$.a = style(_el$0, _v$3, _p$.a);
      _p$.o = style(_el$10, _v$4, _p$.o);
      _p$.i = style(_el$12, _v$5, _p$.i);
      _p$.n = style(_el$14, _v$6, _p$.n);
      _p$.s = style(_el$16, _v$7, _p$.s);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0,
      s: void 0
    });
    return _el$;
  })();
}

// src/components/icons/Hydro.tsx
var _tmpl$49 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.72817,0,0,1.72817,-29.223,-29.1504)><g id=Hydro><g id=standalone1 serif:id=standalone><g transform=matrix(1,0,0,1,2,-1.5)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"></path></g><g transform=matrix(-1,0,0,-1,78.1114,81.5649)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z">`);
function Hydro(props) {
  return (() => {
    var _el$ = _tmpl$49(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild;
    createRenderEffect((_p$) => {
      var _v$ = `fill:${props.fill ?? "rgb(43,168,216)"};`, _v$2 = `fill:${props.fill ?? "rgb(43,168,216)"};`;
      _p$.e = style(_el$6, _v$, _p$.e);
      _p$.t = style(_el$8, _v$2, _p$.t);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}

// src/components/icons/Omni.tsx
var _tmpl$50 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.54461,0,0,1.54461,-22.3824,-21.7702)><g id=Omni><g id=standalone1 serif:id=standalone><g transform=matrix(1.27442,0,0,1.099,-10.2998,-2.98897)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(-0.585385,1.02359,-0.954008,-0.545589,103.249,20.7405)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(0.517371,0.996336,0.97534,-0.506469,-9.83172,37.6917)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(1.13281,-1.73412e-17,1.49543e-17,-1.099,14.7335,84.989)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(-0.547687,0.991618,0.962018,0.531338,13.4075,-3.22855)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(0.55516,1.00515,-0.962018,0.531338,56.4324,-22.5184)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z>`);
function Omni(props) {
  return (() => {
    var _el$ = _tmpl$50(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$1.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$11.nextSibling, _el$14 = _el$13.firstChild;
    createRenderEffect((_p$) => {
      var _v$ = `fill:${props.fill ?? "rgb(223,22,76)"};`, _v$2 = `fill:${props.fill ?? "rgb(223,22,76)"};`, _v$3 = `fill:${props.fill ?? "rgb(223,22,76)"};`, _v$4 = `fill:${props.fill ?? "rgb(223,22,76)"};`, _v$5 = `fill:${props.fill ?? "rgb(223,22,76)"};`, _v$6 = `fill:${props.fill ?? "rgb(223,22,76)"};`;
      _p$.e = style(_el$6, _v$, _p$.e);
      _p$.t = style(_el$8, _v$2, _p$.t);
      _p$.a = style(_el$0, _v$3, _p$.a);
      _p$.o = style(_el$10, _v$4, _p$.o);
      _p$.i = style(_el$12, _v$5, _p$.i);
      _p$.n = style(_el$14, _v$6, _p$.n);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0
    });
    return _el$;
  })();
}

// src/components/icons/Physical.tsx
var _tmpl$51 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(2.47396,0,0,2.05405,-56.4844,-37.027)><g id=Physical><path id=standalone1 serif:id=standalone d=M39,19L52.856,28.25L52.856,46.75L39,56L25.144,46.75L25.144,28.25L39,19ZM29.023,44.16L32.903,41.57L32.903,33.43L39,29.36L45.097,33.43L45.097,41.57L48.977,44.16L48.977,30.84L39,24.18L29.023,30.84L29.023,44.16Z>`);
function Physical(props) {
  return (() => {
    var _el$ = _tmpl$51(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(201,200,206)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Phase.tsx
function Phase(props) {
  switch (props.phase.toLowerCase()) {
    default:
      return createComponent(All, {
        get fill() {
          return props.fill;
        }
      });
    case "physical":
      return createComponent(Physical, {
        get fill() {
          return props.fill;
        }
      });
    case "burn":
      return createComponent(Burn, {
        get fill() {
          return props.fill;
        }
      });
    case "electric":
      return createComponent(Electric, {
        get fill() {
          return props.fill;
        }
      });
    case "freeze":
      return createComponent(Freeze, {
        get fill() {
          return props.fill;
        }
      });
    case "corrosion":
      return createComponent(Corrosion, {
        get fill() {
          return props.fill;
        }
      });
    case "hydro":
      return createComponent(Hydro, {
        get fill() {
          return props.fill;
        }
      });
    case "omni":
      return createComponent(Omni, {
        get fill() {
          return props.fill;
        }
      });
  }
}

// src/components/DollChip.tsx
var _tmpl$54 = /* @__PURE__ */ template(`<div><div><div class="absolute top-1 left-1 h-6 w-6"></div><img loading=lazy class="h-auto w-32 object-cover"></div><div class="bg-[#1C2A32] p-1 text-center font-bold text-[#EFEFEF]">`, true, false, false);
var _tmpl$214 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function DollChip(props) {
  return (() => {
    var _el$ = _tmpl$54(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$2.nextSibling;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$6 = _tmpl$214();
        insert(_el$6, createComponent(Check, {}));
        return _el$6;
      })();
    })(), _el$3);
    insert(_el$3, createComponent(PhaseIcon, {
      get phase() {
        return props.doll.phase;
      }
    }));
    insert(_el$5, () => props.target.name);
    createRenderEffect((_p$) => {
      var _v$ = props.style, _v$2 = `doll ${props.doll.phase} All show h-40.5 w-31.5 cursor-pointer flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 outline-4 transition transition-discrete duration-175 hover:scale-107 hover:outline-white ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"}`, _v$3 = `relative flex justify-center border-b-4 bg-[#C9C8CD] ${props.doll.rarity === "Elite" ? "border-b-[#DF9E00]" : "border-b-[#7968BA]"}`, _v$4 = props.target.avatar;
      _p$.e = style(_el$, _v$, _p$.e);
      _v$2 !== _p$.t && className(_el$, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$2, _p$.a = _v$3);
      _v$4 !== _p$.o && setAttribute(_el$4, "src", _p$.o = _v$4);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/modals/DollSelectorModal.tsx
var _tmpl$55 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75">`);
var _tmpl$215 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="grid grid-cols-6 gap-4">`);
var _tmpl$311 = /* @__PURE__ */ template(`<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Changing dolls will clear their positions and actions`);
var _tmpl$410 = /* @__PURE__ */ template(`<button><div class="h-6 w-6"></div><span>`);
function runAfterFramePaint(callback) {
  requestAnimationFrame(() => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = callback;
    messageChannel.port2.postMessage(void 0);
  });
}
function DollSelectorModal() {
  const toggleDoll = (id) => {
    const sel = tempSelected();
    if (sel.includes(id)) {
      setTempSelected(sel.filter((x) => x !== id));
    } else if (sel.length < 5) {
      setTempSelected([...sel, id]);
    }
  };
  const toggleDollVisibility = async (phase) => {
    console.log("Running Phase Tab for " + phase);
    runAfterFramePaint(() => {
      document.querySelectorAll(`.doll`).forEach((el) => {
        el.classList.remove("show");
      });
      runAfterFramePaint(() => {
        document.querySelectorAll(`.doll.${phase}`).forEach((el) => {
          el.classList.remove("hide");
          el.classList.add("show");
        });
        runAfterFramePaint(() => {
          document.querySelectorAll(`.doll:not(.${phase})`).forEach((el) => {
            el.classList.add("hide");
          });
        });
      });
    });
  };
  return [createComponent(ModalHeader, {
    title: "Select Dolls"
  }), (() => {
    var _el$ = _tmpl$55();
    insert(_el$, createComponent(For, {
      each: PHASE_TABS,
      children: (tab) => (() => {
        var _el$5 = _tmpl$410(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
        _el$5.$$click = () => {
          setActivePhaseTab(tab);
          toggleDollVisibility(tab);
        };
        insert(_el$6, createComponent(Phase, {
          phase: tab,
          get fill() {
            return activePhaseTab() === tab ? "#EFEFEF" : "#384B53";
          }
        }));
        insert(_el$7, tab);
        createRenderEffect(() => className(_el$5, `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${activePhaseTab() === tab ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`));
        return _el$5;
      })()
    }));
    return _el$;
  })(), (() => {
    var _el$2 = _tmpl$215(), _el$3 = _el$2.firstChild;
    insert(_el$3, createComponent(For, {
      each: allDolls,
      children: (doll) => {
        const isSel = () => tempSelected().includes(doll.id);
        return createComponent(DollChip, {
          target: doll,
          doll,
          get selected() {
            return isSel();
          },
          onClick: () => toggleDoll(doll.id),
          get style() {
            return `--animation-order: ${visibleDollIndex(doll)};order:${visibleDollIndex(doll)}`;
          }
        });
      }
    }));
    return _el$2;
  })(), _tmpl$311(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setShowDollModal(false),
        color: "dark",
        design: "cancel"
      }), createComponent(Button, {
        onClick: () => {
          setShowDollModal(false);
          setShowFortificationModal(true);
        },
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["click"]);

// src/components/modals/FortificationModal.tsx
var _tmpl$56 = /* @__PURE__ */ template(`<div class="flex flex-col items-center gap-3 p-2">`);
var _tmpl$216 = /* @__PURE__ */ template(`<div class="flex items-center gap-4"><div class="flex gap-2">`);
var _tmpl$312 = /* @__PURE__ */ template(`<button>`);
function FortificationModal() {
  const setNum = (dollId, num) => {
    setDollFortification((prev) => ({
      ...prev,
      [dollId]: num
    }));
  };
  const confirm = async () => {
    setShowFortificationModal(false);
    const selectedDolls = tempSelected().map((dollId) => ({
      id: dollId,
      fortification: dollFortification()[dollId] ?? 0
    }));
    changeSelectedDolls(selectedDolls);
    await preloadCanvasImages();
    setTempSelected([]);
    for (let i = 0; i < 8; i++) defaultActionOrder(i);
    saveToLocalStorage();
  };
  return [createComponent(ModalHeader, {
    title: "Set Doll Fortifications"
  }), (() => {
    var _el$ = _tmpl$56();
    insert(_el$, createComponent(For, {
      get each() {
        return tempSelected();
      },
      children: (dollId) => {
        const dollInfo = getInfoFromId(dollId);
        if (!dollInfo) return null;
        const currentNum = () => dollFortification()[dollId] ?? state.selectedDolls.find((d) => d.id === dollId)?.fortification ?? 0;
        return (() => {
          var _el$2 = _tmpl$216(), _el$3 = _el$2.firstChild;
          insert(_el$2, createComponent(SmallDollChip, {
            target: dollInfo,
            get doll() {
              return getDollFromSummon(dollInfo);
            }
          }), _el$3);
          insert(_el$3, createComponent(For, {
            each: [0, 1, 2, 3, 4, 5, 6],
            children: (n) => (() => {
              var _el$4 = _tmpl$312();
              _el$4.$$click = () => setNum(dollId, n);
              insert(_el$4, n);
              createRenderEffect(() => className(_el$4, `text-md h-9 w-9 cursor-pointer rounded-sm bg-[#384B53] font-bold text-[#EFEFEF] shadow-sm shadow-black/50 outline-3 transition-all hover:scale-107 hover:outline-white ${currentNum() === n ? "outline-[#F26C1C]" : "outline-transparent"}`));
              return _el$4;
            })()
          }));
          return _el$2;
        })();
      }
    }));
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-center",
    get children() {
      return createComponent(Button, {
        onClick: confirm,
        color: "dark",
        design: "confirm"
      });
    }
  })];
}
delegateEvents(["click"]);

// src/components/modals/ImportModal.tsx
var _tmpl$57 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><textarea class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-4 font-mono text-xs"placeholder="Paste here..."></textarea><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Imported state will overwrite all current settings`);
function ImportModal() {
  const [text, setText] = createSignal("");
  const performImport = async () => {
    const oldState = localStorage.getItem(STORAGE_KEY);
    try {
      setLoaded(false);
      const decompressed = await decompress(text().trim());
      const parsed = JSON.parse(decompressed);
      if (parsed.version !== SAVE_VERSION) {
        alert("Unsupported version");
        return;
      }
      loadState(parsed);
      for (let i = 0; i < 8; i++) defaultActionOrder(i);
      await preloadCanvasImages();
      setShowImportModal(false);
      saveToLocalStorage();
      setLoaded(true);
      alert("\u2705 Import successful!");
    } catch (e) {
      console.error(e);
      alert("Invalid string!");
      if (!oldState) return;
      const data = JSON.parse(oldState);
      if (data.version !== SAVE_VERSION) return false;
      loadState(data);
      setLoaded(true);
    }
  };
  return [createComponent(ModalHeader, {
    title: "Import Transcript"
  }), (() => {
    var _el$ = _tmpl$57(), _el$2 = _el$.firstChild;
    _el$2.$$input = (e) => setText(e.currentTarget.value);
    createRenderEffect(() => _el$2.value = text());
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setShowImportModal(false),
        color: "dark",
        design: "cancel"
      }), createComponent(Button, {
        onClick: performImport,
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["input"]);

// src/components/modals/TargetModal.tsx
var _tmpl$58 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"><div class="overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]"><div class="border-b border-zinc-700 p-6 text-center"><h3 class="text-lg font-bold">Select Target Character</h3><p class="text-xs text-zinc-400"> \u2192 Target</p></div><div class="grid grid-cols-3 justify-items-center gap-4 p-5"></div><div class="flex justify-center gap-4 border-t border-zinc-700 p-6">`);
function TargetModal() {
  const skillInfo = createMemo(() => {
    const dollId = targetDollId();
    const skillId = targetSkillId();
    if (!dollId || skillId == null) return null;
    const doll = getInfoFromId(dollId);
    return doll?.skills.find((s) => s.id === skillId) ?? null;
  });
  const targets = createMemo(() => getSelectedDollAndSummonInfo([targetDollId() ?? ""]));
  const recordSkill2 = (dollId, entry) => {
    setState(produce((s) => {
      const tab = s.tabData[s.currentTab];
      if (!tab.actions[dollId]) tab.actions[dollId] = [];
      tab.actions[dollId].push(entry);
    }));
    saveToLocalStorage();
  };
  const handleSelect = (target) => {
    const dollId = targetDollId();
    const skillId = targetSkillId();
    if (!dollId || skillId == null) return;
    recordSkill2(dollId, [skillId, target.id]);
    setShowTargetModal(false);
  };
  return (() => {
    var _el$ = _tmpl$58(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$3.nextSibling, _el$8 = _el$7.nextSibling;
    insert(_el$5, () => skillInfo()?.name, _el$6);
    insert(_el$7, createComponent(For, {
      get each() {
        return targets();
      },
      children: (doll) => createComponent(DollChip, {
        onClick: () => handleSelect(doll),
        target: doll,
        get doll() {
          return getDollFromSummon(doll);
        },
        get style() {
          return `--animation-order: ${targets().findIndex((d) => d.id === doll.id)};order:${targets().findIndex((d) => d.id === doll.id)}`;
        }
      })
    }));
    insert(_el$8, createComponent(Button, {
      onClick: () => setShowTargetModal(false),
      color: "light",
      design: "cancel"
    }));
    return _el$;
  })();
}

// node_modules/@thisbeyond/solid-select/dist/dev.js
var createSelect = (props) => {
  const config = mergeProps({
    multiple: false,
    disabled: false,
    optionToValue: (option) => option,
    isOptionDisabled: (option) => false
  }, props);
  const parseValue = (value2) => {
    if (config.multiple && Array.isArray(value2)) {
      return value2;
    } else if (!config.multiple && !Array.isArray(value2)) {
      return value2 !== null ? [value2] : [];
    } else {
      throw new Error(`Incompatible value type for ${config.multiple ? "multple" : "single"} select.`);
    }
  };
  const [_value, _setValue] = createSignal(config.initialValue !== void 0 ? parseValue(config.initialValue) : []);
  const value = () => config.multiple ? _value() : _value()[0] || null;
  const setValue = (value2) => _setValue(parseValue(value2));
  const clearValue = () => _setValue([]);
  const hasValue = () => !!(config.multiple ? value().length : value());
  createEffect(on(_value, () => config.onChange?.(value()), {
    defer: true
  }));
  const [inputValue, setInputValue] = createSignal("");
  const clearInputValue = () => setInputValue("");
  const hasInputValue = () => !!inputValue().length;
  createEffect(on(inputValue, (inputValue2) => config.onInput?.(inputValue2), {
    defer: true
  }));
  createEffect(on(inputValue, (inputValue2) => {
    if (inputValue2 && !isOpen()) {
      setIsOpen(true);
    }
  }, {
    defer: true
  }));
  const options = typeof config.options === "function" ? createMemo(() => config.options(inputValue()), config.options(inputValue())) : () => config.options;
  const optionsCount = () => options().length;
  const pickOption = (option) => {
    if (config.isOptionDisabled(option)) return;
    const value2 = config.optionToValue(option);
    if (config.multiple) {
      setValue([..._value(), value2]);
    } else {
      setValue(value2);
      setIsActive(false);
    }
    setIsOpen(false);
  };
  const [isActive, setIsActive] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(false);
  const toggleOpen = () => setIsOpen(!isOpen());
  const [focusedOptionIndex, setFocusedOptionIndex] = createSignal(-1);
  const focusedOption = () => options()[focusedOptionIndex()];
  const isOptionFocused = (option) => option === focusedOption();
  const focusOption = (direction) => {
    if (!optionsCount()) setFocusedOptionIndex(-1);
    const max = optionsCount() - 1;
    const delta = direction === "next" ? 1 : -1;
    let index = focusedOptionIndex() + delta;
    if (index > max) {
      index = 0;
    }
    if (index < 0) {
      index = max;
    }
    setFocusedOptionIndex(index);
  };
  const focusPreviousOption = () => focusOption("previous");
  const focusNextOption = () => focusOption("next");
  createEffect(on(options, (options2) => {
    if (isOpen()) setFocusedOptionIndex(Math.min(0, options2.length - 1));
  }, {
    defer: true
  }));
  createEffect(on(() => config.disabled, (isDisabled) => {
    if (isDisabled && isOpen()) {
      setIsOpen(false);
    }
  }));
  createEffect(on(isOpen, (isOpen2) => {
    if (isOpen2) {
      if (focusedOptionIndex() === -1) focusNextOption();
      setIsActive(true);
    } else {
      if (focusedOptionIndex() > -1) setFocusedOptionIndex(-1);
      setInputValue("");
    }
  }, {
    defer: true
  }));
  createEffect(on(focusedOptionIndex, (focusedOptionIndex2) => {
    if (focusedOptionIndex2 > -1 && !isOpen()) {
      setIsOpen(true);
    }
  }, {
    defer: true
  }));
  const onFocusIn = () => setIsActive(true);
  const onFocusOut = () => {
    setIsActive(false);
    setIsOpen(false);
  };
  const onMouseDown = (event) => event.preventDefault();
  const onClick = (event) => {
    if (!config.disabled && !hasInputValue()) toggleOpen();
  };
  const onInput = (event) => {
    setInputValue(event.target.value);
  };
  const onKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
        focusNextOption();
        break;
      case "ArrowUp":
        focusPreviousOption();
        break;
      case "Enter":
        if (isOpen() && focusedOption()) {
          pickOption(focusedOption());
          break;
        }
        return;
      case "Escape":
        if (isOpen()) {
          setIsOpen(false);
          break;
        }
        return;
      case "Delete":
      case "Backspace":
        if (inputValue()) {
          return;
        }
        if (config.multiple) {
          const currentValue = value();
          setValue([...currentValue.slice(0, -1)]);
        } else {
          clearValue();
        }
        break;
      case " ":
        if (inputValue()) {
          return;
        }
        if (!isOpen()) {
          setIsOpen(true);
        } else {
          if (focusedOption()) {
            pickOption(focusedOption());
          }
        }
        break;
      case "Tab":
        if (focusedOption() && isOpen()) {
          pickOption(focusedOption());
          break;
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  return {
    options,
    value,
    setValue,
    hasValue,
    clearValue,
    inputValue,
    setInputValue,
    hasInputValue,
    clearInputValue,
    isOpen,
    setIsOpen,
    toggleOpen,
    isActive,
    setIsActive,
    get multiple() {
      return config.multiple;
    },
    get disabled() {
      return config.disabled;
    },
    pickOption,
    isOptionFocused,
    isOptionDisabled: config.isOptionDisabled,
    onFocusIn,
    onFocusOut,
    onMouseDown,
    onClick,
    onInput,
    onKeyDown
  };
};
var _tmpl$217 = /* @__PURE__ */ template(`<div>`);
var _tmpl$222 = /* @__PURE__ */ template(`<div class=solid-select-control>`);
var _tmpl$313 = /* @__PURE__ */ template(`<div class=solid-select-placeholder>`);
var _tmpl$411 = /* @__PURE__ */ template(`<div class=solid-select-single-value>`);
var _tmpl$59 = /* @__PURE__ */ template(`<div class=solid-select-multi-value><span></span><button type=button class=solid-select-multi-value-remove>\u2A2F`);
var _tmpl$63 = /* @__PURE__ */ template(`<input class=solid-select-input type=text tabindex=0 autocomplete=off autocapitalize=none autocorrect=off size=1>`);
var _tmpl$73 = /* @__PURE__ */ template(`<div class=solid-select-list>`);
var _tmpl$82 = /* @__PURE__ */ template(`<div class=solid-select-list-placeholder>`);
var _tmpl$92 = /* @__PURE__ */ template(`<div class=solid-select-option>`);
var SelectContext = createContext();
var useSelect = () => {
  const context = useContext(SelectContext);
  if (!context) throw new Error("No SelectContext found in ancestry.");
  return context;
};
var Select = (props) => {
  const [selectProps, local] = splitProps(mergeProps({
    format: (data, type) => data,
    placeholder: "Select...",
    readonly: typeof props.options !== "function",
    loading: false,
    loadingPlaceholder: "Loading...",
    emptyPlaceholder: "No options"
  }, props), ["options", "optionToValue", "isOptionDisabled", "multiple", "disabled", "onInput", "onChange"]);
  const select = createSelect(selectProps);
  createEffect(on(() => local.initialValue, (value) => value !== void 0 && select.setValue(value)));
  return createComponent(SelectContext.Provider, {
    value: select,
    get children() {
      return createComponent(Container, {
        get ["class"]() {
          return local.class;
        },
        get children() {
          return [createComponent(Control, {
            get id() {
              return local.id;
            },
            get name() {
              return local.name;
            },
            get format() {
              return local.format;
            },
            get placeholder() {
              return local.placeholder;
            },
            get autofocus() {
              return local.autofocus;
            },
            get readonly() {
              return local.readonly;
            },
            ref(r$) {
              var _ref$ = props.ref;
              typeof _ref$ === "function" ? _ref$(r$) : props.ref = r$;
            }
          }), createComponent(List, {
            get loading() {
              return local.loading;
            },
            get loadingPlaceholder() {
              return local.loadingPlaceholder;
            },
            get emptyPlaceholder() {
              return local.emptyPlaceholder;
            },
            get format() {
              return local.format;
            }
          })];
        }
      });
    }
  });
};
var Container = (props) => {
  const select = useSelect();
  return (() => {
    var _el$ = _tmpl$217();
    _el$.$$mousedown = (event) => {
      select.onMouseDown(event);
      event.currentTarget.getElementsByTagName("input")[0].focus();
    };
    addEventListener(_el$, "focusout", select.onFocusOut, true);
    addEventListener(_el$, "focusin", select.onFocusIn, true);
    insert(_el$, () => props.children);
    createRenderEffect((_p$) => {
      var _v$ = `solid-select-container ${props.class !== void 0 ? props.class : ""}`, _v$2 = select.disabled;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "data-disabled", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
};
var Control = (props) => {
  const select = useSelect();
  const removeValue = (index) => {
    const value = select.value();
    select.setValue([...value.slice(0, index), ...value.slice(index + 1)]);
  };
  return (() => {
    var _el$2 = _tmpl$222();
    addEventListener(_el$2, "click", select.onClick, true);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!!select.hasValue())() && !select.hasInputValue();
      },
      get children() {
        return createComponent(Placeholder, {
          get children() {
            return props.placeholder;
          }
        });
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!(select.hasValue() && !select.multiple))() && !select.hasInputValue();
      },
      get children() {
        return createComponent(SingleValue, {
          get children() {
            return props.format(select.value(), "value");
          }
        });
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!select.hasValue())() && select.multiple;
      },
      get children() {
        return createComponent(For, {
          get each() {
            return select.value();
          },
          children: (value, index) => createComponent(MultiValue, {
            onRemove: () => removeValue(index()),
            get children() {
              return props.format(value, "value");
            }
          })
        });
      }
    }), null);
    insert(_el$2, createComponent(Input, {
      get id() {
        return props.id;
      },
      get name() {
        return props.name;
      },
      get autofocus() {
        return props.autofocus;
      },
      get readonly() {
        return props.readonly;
      },
      ref(r$) {
        var _ref$2 = props.ref;
        typeof _ref$2 === "function" ? _ref$2(r$) : props.ref = r$;
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$3 = select.multiple, _v$4 = select.hasValue(), _v$5 = select.disabled;
      _v$3 !== _p$.e && setAttribute(_el$2, "data-multiple", _p$.e = _v$3);
      _v$4 !== _p$.t && setAttribute(_el$2, "data-has-value", _p$.t = _v$4);
      _v$5 !== _p$.a && setAttribute(_el$2, "data-disabled", _p$.a = _v$5);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$2;
  })();
};
var Placeholder = (props) => {
  return (() => {
    var _el$3 = _tmpl$313();
    insert(_el$3, () => props.children);
    return _el$3;
  })();
};
var SingleValue = (props) => {
  return (() => {
    var _el$4 = _tmpl$411();
    insert(_el$4, () => props.children);
    return _el$4;
  })();
};
var MultiValue = (props) => {
  useSelect();
  return (() => {
    var _el$5 = _tmpl$59(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
    insert(_el$6, () => props.children);
    _el$7.$$click = (event) => {
      event.stopPropagation();
      props.onRemove();
    };
    return _el$5;
  })();
};
var Input = (props) => {
  const select = useSelect();
  return (() => {
    var _el$8 = _tmpl$63();
    _el$8.$$mousedown = (event) => {
      event.stopPropagation();
    };
    _el$8.$$keydown = (event) => {
      select.onKeyDown(event);
      if (!event.defaultPrevented) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          event.target.blur();
        }
      }
    };
    addEventListener(_el$8, "input", select.onInput, true);
    var _ref$3 = props.ref;
    typeof _ref$3 === "function" ? use(_ref$3, _el$8) : props.ref = _el$8;
    createRenderEffect((_p$) => {
      var _v$6 = props.id, _v$7 = props.name, _v$8 = select.multiple, _v$9 = select.isActive(), _v$0 = props.autofocus, _v$1 = props.readonly, _v$10 = select.disabled;
      _v$6 !== _p$.e && setAttribute(_el$8, "id", _p$.e = _v$6);
      _v$7 !== _p$.t && setAttribute(_el$8, "name", _p$.t = _v$7);
      _v$8 !== _p$.a && setAttribute(_el$8, "data-multiple", _p$.a = _v$8);
      _v$9 !== _p$.o && setAttribute(_el$8, "data-is-active", _p$.o = _v$9);
      _v$0 !== _p$.i && (_el$8.autofocus = _p$.i = _v$0);
      _v$1 !== _p$.n && (_el$8.readOnly = _p$.n = _v$1);
      _v$10 !== _p$.s && (_el$8.disabled = _p$.s = _v$10);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0,
      s: void 0
    });
    createRenderEffect(() => _el$8.value = select.inputValue());
    return _el$8;
  })();
};
var List = (props) => {
  const select = useSelect();
  return createComponent(Show, {
    get when() {
      return select.isOpen();
    },
    get children() {
      var _el$9 = _tmpl$73();
      insert(_el$9, createComponent(Show, {
        get when() {
          return !props.loading;
        },
        get fallback() {
          return (() => {
            var _el$0 = _tmpl$82();
            insert(_el$0, () => props.loadingPlaceholder);
            return _el$0;
          })();
        },
        get children() {
          return createComponent(For, {
            get each() {
              return select.options();
            },
            get fallback() {
              return (() => {
                var _el$1 = _tmpl$82();
                insert(_el$1, () => props.emptyPlaceholder);
                return _el$1;
              })();
            },
            children: (option) => createComponent(Option, {
              option,
              get children() {
                return props.format(option, "option");
              }
            })
          });
        }
      }));
      return _el$9;
    }
  });
};
var Option = (props) => {
  const select = useSelect();
  const scrollIntoViewOnFocus = (element) => {
    createEffect(() => {
      if (select.isOptionFocused(props.option)) {
        element.scrollIntoView({
          block: "nearest"
        });
      }
    });
  };
  return (() => {
    var _el$10 = _tmpl$92();
    _el$10.$$click = () => select.pickOption(props.option);
    use(scrollIntoViewOnFocus, _el$10);
    insert(_el$10, () => props.children);
    createRenderEffect((_p$) => {
      var _v$11 = select.isOptionDisabled(props.option), _v$12 = select.isOptionFocused(props.option);
      _v$11 !== _p$.e && setAttribute(_el$10, "data-disabled", _p$.e = _v$11);
      _v$12 !== _p$.t && setAttribute(_el$10, "data-focused", _p$.t = _v$12);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$10;
  })();
};
delegateEvents(["focusin", "focusout", "mousedown", "click", "input", "keydown"]);

// src/components/modals/ExportModal.tsx
var _tmpl$60 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Export as Text</div><div class="mx-3 flex flex-row items-center justify-center gap-1 text-[#384B53]"><span>Export style:</span></div><textarea class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs"placeholder=Loading...>`);
function ExportModal() {
  const exportOptions = ["code only", "code for discord", "shareable url"];
  const [exportType, setExportType] = createSignal(exportOptions[2]);
  const [copied, setCopied] = createSignal(false);
  const getExportString = async () => {
    const exportObj = {
      version: SAVE_VERSION,
      ...state
    };
    return await compress(JSON.stringify(exportObj));
  };
  const [exportString] = createResource(getExportString);
  const output = createMemo(() => {
    const dolls = getDollNamesAndFortifications();
    if (exportType() === exportOptions[0]) return exportString();
    if (exportType() === exportOptions[1]) return dolls.join(", ") + "\n```" + exportString() + "```";
    if (exportType() === exportOptions[2]) return dolls.join(", ") + `
${window.location.origin + window.location.pathname}?state=` + exportString();
    return exportString();
  });
  const handleCopy = async () => {
    await navigator.clipboard.writeText(output() ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return [createComponent(ModalHeader, {
    title: "Export Transcript"
  }), (() => {
    var _el$ = _tmpl$60(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.firstChild, _el$5 = _el$3.nextSibling;
    insert(_el$3, createComponent(Select, {
      "class": "custom",
      options: exportOptions,
      onChange: setExportType,
      get initialValue() {
        return exportType();
      }
    }), null);
    createRenderEffect(() => _el$5.value = output());
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setShowExportModal(false),
        color: "dark",
        design: "cancel",
        content: "Close"
      }), createComponent(Button, {
        onClick: handleCopy,
        color: "dark",
        design: "confirm",
        get content() {
          return copied() ? "Copied!" : "Copy Text";
        }
      })];
    }
  })];
}

// src/components/modals/SkillDisplayModal.tsx
var _tmpl$61 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2 self-center"><div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]"><span>Override imported notations:</span></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Preview</div><div class="flex flex-wrap justify-center gap-1.5">`);
var _tmpl$218 = /* @__PURE__ */ template(`<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]"><span>`);
var _tmpl$314 = /* @__PURE__ */ template(`<div class="flex flex-col gap-1"><div class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-center text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50">`);
function SkillDisplayModal() {
  const dollInfo = getDollFromId("d54");
  const basicSkill = dollInfo?.skills?.filter((s) => s.type === "Basic Attack") ?? [];
  const passiveSkill = dollInfo?.skills?.filter((s) => s.type === "Passive") ?? [];
  const numberedSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [0-9]/)) ?? [];
  const letteredSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [A-Z]/)) ?? [];
  const skills = [...basicSkill, ...numberedSkills, ...passiveSkill, ...letteredSkills];
  return [createComponent(ModalHeader, {
    title: "Skill Display"
  }), (() => {
    var _el$ = _tmpl$61(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.nextSibling;
    insert(_el$2, createComponent(Select, {
      "class": "custom",
      options: ["true", "false"],
      onChange: (value) => {
        setOverrideSkillNotations(value === "true" ? true : false);
        saveToLocalStorage();
      },
      get initialValue() {
        return String(overrideSkillNotations());
      }
    }), null);
    insert(_el$, createComponent(For, {
      get each() {
        return Object.entries(notations);
      },
      children: ([notation, values]) => (() => {
        var _el$6 = _tmpl$218(), _el$7 = _el$6.firstChild;
        insert(_el$7, `${notation} style:`);
        insert(_el$6, createComponent(Select, {
          "class": "custom",
          options: values,
          onChange: (value) => setSkillDisplay(notation, value),
          get initialValue() {
            return getSkillDisplay(notation);
          }
        }), null);
        return _el$6;
      })()
    }), _el$4);
    insert(_el$5, createComponent(For, {
      each: skills,
      children: (skill, idx) => (() => {
        var _el$8 = _tmpl$314(), _el$9 = _el$8.firstChild;
        insert(_el$8, createComponent(SkillIcon, {
          skill
        }), _el$9);
        insert(_el$9, () => renderAction("d54", [skill.id]));
        createRenderEffect(() => setAttribute(_el$9, "data-skill-id", skill.id));
        return _el$8;
      })()
    }));
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-center",
    get children() {
      return createComponent(Button, {
        onClick: () => setShowSkillDisplayModal(false),
        color: "dark",
        design: "cancel",
        content: "Close"
      });
    }
  })];
}

// src/App.tsx
var _tmpl$64 = /* @__PURE__ */ template(`<div class="absolute right-0 left-0 flex items-center justify-center bg-zinc-950">`);
var _tmpl$219 = /* @__PURE__ */ template(`<div class="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs text-lime-400">`);
var _tmpl$315 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75"><button><span>Setup</span></button><button><span>Doll Actions`);
var _tmpl$412 = /* @__PURE__ */ template(`<div class="absolute top-3.75 bottom-3.75 left-3.75 z-10 flex">`);
var _tmpl$510 = /* @__PURE__ */ template(`<div class="flex h-screen flex-col bg-zinc-950 text-white"><div class="relative flex-1 overflow-hidden"id=body>`);
function App() {
  const [coords, setCoords] = createSignal("");
  const [activeTab, setActiveTab] = createSignal("setup");
  onMount(async () => {
    try {
      await loadCombinedJson();
      loadEditorMap();
      const params = new URLSearchParams(window.location.search);
      let restored = false;
      if (params.has("state")) {
        restored = await loadFromURL();
      } else {
        restored = loadFromLocalStorage();
      }
      if (restored) {
        console.log("Restored state");
        await preloadCanvasImages();
      }
      for (let i = 0; i < 8; i++) defaultActionOrder(i);
      if (!restored) saveToLocalStorage();
      const saved = localStorage.getItem(SKILL_DISPLAY_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setOverrideSkillNotations(data.override);
        if (data.override === true) {
          overrideSkillDisplay(data.skillDisplay);
        }
      }
      setLoaded(true);
    } catch (e) {
      console.error("Please let ArkahnX know about the following error");
      console.error(e);
      alert("potentially uncaught error encountered - check console for details");
    }
  });
  const isSetupTab = () => activeTab() === "setup" || state.currentTab === 0;
  const isActionTab = () => activeTab() === "actions" && state.currentTab > 0;
  const isEditorTab = () => state.currentTab === -1;
  const isArenaTab = () => state.currentTab >= 0 && state.currentTab <= 7;
  const isSummaryTab = () => state.currentTab === 8;
  const showSidebars = () => state.currentTab > 0 && state.currentTab < 8;
  const handleTabChange = (tab) => {
    if (tab === -1) {
      setTimeout(() => editorRender(), 0);
    }
  };
  return (() => {
    var _el$ = _tmpl$510(), _el$2 = _el$.firstChild;
    insert(_el$, createComponent(TabBar, {
      onTabChange: handleTabChange
    }), _el$2);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isArenaTab())() && loaded();
      },
      get children() {
        return [(() => {
          var _el$3 = _tmpl$64();
          insert(_el$3, createComponent(ArenaCanvas, {
            onCoordsChange: setCoords,
            onMouseUp: () => {
            }
          }));
          return _el$3;
        })(), (() => {
          var _el$4 = _tmpl$219();
          insert(_el$4, () => coords() || "00,00");
          return _el$4;
        })()];
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isArenaTab())() && loaded();
      },
      get children() {
        var _el$5 = _tmpl$412();
        insert(_el$5, createComponent(Modal, {
          width: "w-96",
          get children() {
            return [(() => {
              var _el$6 = _tmpl$315(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling;
              _el$7.$$click = () => {
                setActiveTab("setup");
              };
              _el$8.$$click = () => {
                setActiveTab("actions");
              };
              createRenderEffect((_p$) => {
                var _v$ = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isSetupTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isActionTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"} ${state.currentTab === 0 ? "cursor-not-allowed opacity-50" : ""}`;
                _v$ !== _p$.e && className(_el$7, _p$.e = _v$);
                _v$2 !== _p$.t && className(_el$8, _p$.t = _v$2);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$6;
            })(), createComponent(SetupSidebar, {
              get active() {
                return isSetupTab();
              }
            }), createComponent(ActionSidebar, {
              get active() {
                return isActionTab();
              }
            })];
          }
        }));
        return _el$5;
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isEditorTab())() && loaded();
      },
      get children() {
        return createComponent(EditorView, {});
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isSummaryTab())() && loaded();
      },
      get children() {
        return createComponent(SummaryView, {});
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showDollModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              get children() {
                return createComponent(DollSelectorModal, {});
              }
            });
          }
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showFortificationModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              width: "w-[420px]",
              get children() {
                return createComponent(FortificationModal, {});
              }
            });
          }
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showImportModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              width: "w-140",
              get children() {
                return createComponent(ImportModal, {});
              }
            });
          }
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showExportModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              width: "w-140",
              get children() {
                return createComponent(ExportModal, {});
              }
            });
          }
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showSkillDisplayModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              width: "w-96",
              get children() {
                return createComponent(SkillDisplayModal, {});
              }
            });
          }
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showTargetModal())() && loaded();
      },
      get children() {
        return createComponent(TargetModal, {});
      }
    }), null);
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/index.tsx
var root = document.getElementById("root");
if (!root) throw new Error("No #root element found");
render(() => createComponent(App, {}), root);
new EventSource("/esbuild").addEventListener("change", () => location.reload());
