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
  let items = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
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
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++) ;
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
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
          item = items[i];
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
        items = newItems.slice(0);
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
      const cleanup = () => setClean(true);
      createRoot((dispose2) => insert(el, () => !clean() ? content() : dispose2(), null));
      onCleanup(cleanup);
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

// src/types/index.ts
var PHASE_TABS = ["All", "Physical", "Burn", "Electric", "Freeze", "Corrosion", "Hydro"];

// src/types/constants.ts
var MAP_SIZE = 21;
var TILE_SIZE = 32;
var SCALE = 2;
var CANVAS_SIZE = MAP_SIZE * TILE_SIZE;
var E_PAD = 6;
var HALF_HEIGHT = Math.round(TILE_SIZE * 0.15);
var FULL_HEIGHT = Math.round(TILE_SIZE * 0.35);
var CURRENT_SEASON = 26;
var V7_SAVE_VERSION = 7;
var V7_STORAGE_KEY = "arenaPlannerState_v" + V7_SAVE_VERSION;
var V7_EDITOR_MAP_KEY = "arenaEditorMap_v2";
var V7_SKILL_DISPLAY_KEY = "arenaSkillDisplay_v1";
var SAVE_VERSION = 8;
var SAVED_STATES_KEY = "gunsmoke_state_ids";
var STORAGE_KEY = "gunsmoke_state_v" + SAVE_VERSION;
var SKILL_DISPLAY_KEY = "gunsmoke_skills_v" + SAVE_VERSION;
var DOLL_LOADOUT_KEY = (dollId) => `gunsmoke_doll_${dollId}_v${SAVE_VERSION}`;
var CUSTOM_MAP_KEY = "gunsmoke_custom_map_v" + SAVE_VERSION;
var MIN_SCALE = 0.25;
var MAX_SCALE = 10;
var MAP_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: MAP_SIZE * TILE_SIZE,
  maxY: MAP_SIZE * TILE_SIZE
};

// src/canvas/editorMap.ts
var [editingMap, setEditingMap] = createSignal("Blade Guard Titan");
var empty__ = 0 /* Empty */;
var spawn__ = 1 /* Spawn */;
var hbound_ = 2 /* HBoundary */;
var hspawn_ = 2 /* HBoundary */ | 1 /* Spawn */;
var vbound_ = 4 /* VBoundary */;
var vspawn_ = 4 /* VBoundary */ | 1 /* Spawn */;
var hcover_ = 8 /* HalfCover */;
var fcover_ = 16 /* FullCover */;
var bosssub = 32 /* BossCover */;
var bossman = 64 /* BossOrigin */;
var maps = [{
  name: "Tusk Beasteel",
  size: 21,
  locked: true,
  priority: [],
  tiles: [
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    hcover_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    spawn__,
    empty__,
    empty__,
    spawn__,
    empty__,
    empty__,
    spawn__,
    hcover_,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    hcover_,
    hcover_,
    hbound_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hcover_,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    hbound_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    spawn__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    spawn__,
    fcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    bosssub,
    bosssub,
    bosssub,
    empty__,
    empty__,
    empty__,
    empty__,
    fcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    bosssub,
    bossman,
    bosssub,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    fcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    bosssub,
    bosssub,
    bosssub,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    fcover_,
    spawn__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    spawn__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    hbound_,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    hcover_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    hcover_,
    spawn__,
    empty__,
    empty__,
    spawn__,
    empty__,
    empty__,
    spawn__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    hcover_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__
  ]
}, {
  name: "Blade Guard Titan",
  size: 16,
  locked: true,
  default: true,
  priority: [gridKey(4, 6, 16), gridKey(4, 8, 16), gridKey(9, 11, 16), gridKey(7, 11, 16), gridKey(8, 13, 16), gridKey(2, 7, 16), gridKey(14, 7, 16), gridKey(12, 8, 16), gridKey(12, 6, 16), gridKey(8, 1, 16), gridKey(7, 3, 16), gridKey(9, 3, 16)],
  tiles: [
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    spawn__,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hcover_,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    fcover_,
    fcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    empty__,
    empty__,
    hcover_,
    hspawn_,
    empty__,
    hspawn_,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    hbound_,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    vspawn_,
    vbound_,
    empty__,
    bosssub,
    bosssub,
    bosssub,
    empty__,
    vbound_,
    vspawn_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    spawn__,
    hcover_,
    empty__,
    vbound_,
    vbound_,
    bosssub,
    bossman,
    bosssub,
    vbound_,
    vbound_,
    empty__,
    hcover_,
    spawn__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    vspawn_,
    vbound_,
    empty__,
    bosssub,
    bosssub,
    bosssub,
    empty__,
    vbound_,
    vspawn_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    hbound_,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    hspawn_,
    empty__,
    hspawn_,
    hcover_,
    empty__,
    empty__,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    fcover_,
    fcover_,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    hcover_,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    spawn__,
    empty__,
    empty__,
    empty__,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__
  ]
}, { name: "Custom", size: 21, priority: [], tiles: Array(21 * 21).fill(empty__) }];
function getDefaultMap() {
  for (const map of maps) {
    if (map.default) {
      return map;
    }
  }
  return maps[0];
}
function mapNames() {
  return maps.map((map) => map.name);
}
function loadMap(name) {
  const map = maps.find((map2) => map2.name === name);
  if (map) {
    setEditingMap(name);
    setMap(map.name, map.size, map.tiles, map.priority ?? []);
  }
}
function editorSerialize() {
  for (const map of maps) {
    if (map.name === editingMap()) {
      return JSON.stringify(map);
    }
  }
  return "";
}
function editorDeserialize(text) {
  try {
    const data = JSON.parse(text);
    const oldCustomMap = maps.find((map) => map.name === "Custom");
    if (oldCustomMap) {
      maps.splice(maps.indexOf(oldCustomMap), 1);
    }
    maps.push(data);
    return;
  } catch {
  }
}
function saveEditorMap() {
  for (const map of maps) {
    if (map.name === "Custom") {
      localStorage.setItem(V7_EDITOR_MAP_KEY, JSON.stringify(map));
    }
  }
}
function loadEditorMap() {
  const saved = localStorage.getItem(V7_EDITOR_MAP_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      const oldCustomMap = maps.find((map) => map.name === "Custom");
      if (oldCustomMap) {
        maps.splice(maps.indexOf(oldCustomMap), 1);
      }
      maps.push(data);
      return;
    } catch {
    }
  }
  editorResetLayout();
}
function editorClearAll() {
  mapGrid.tiles.length = 0;
}
function editorResetLayout() {
  editorClearAll();
  const defaultMap = getDefaultMap();
  setMap(defaultMap.name, defaultMap.size, defaultMap.tiles, defaultMap.priority);
}

// src/canvas/draw.ts
function drawFloor(ctx3, c, r) {
  const bossCoords = getBoss();
  const distance2 = Math.abs(c - bossCoords.x) + Math.abs(r - bossCoords.y);
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
  const labelW = Math.ceil(ctx3.measureText(distance2.toString()).width) + 4;
  ctx3.fillRect(x + 6, y + 2, labelW, fontSize + 2);
  ctx3.fillStyle = "#27272a";
  ctx3.fillText(distance2.toString(), x + 6, y + 2);
}
function drawSpawn(ctx3, c, r) {
  const x = cellX(c);
  const y = cellY(r);
  const mapCoord = gridKey(c, r);
  const priority = mapGrid.priority.indexOf(mapCoord);
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
  ctx3.font = `bold 5px Roboto, sans-serif`;
  ctx3.textAlign = "left";
  ctx3.textBaseline = "top";
  const text = (priority + 1).toString() + "\nPriority";
  const labelW = Math.ceil(ctx3.measureText(text).width);
  ctx3.fillStyle = "#4888ff";
  ctx3.fillText(text, x + labelW / 5, y + 3);
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
  const x = cellX(c - 1), y = cellY(r - 1);
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
function obscured(x, y, dollId, instanceId, dollGrid) {
  const tileBelow = mapGrid.tiles[gridKey(x, y + 1)];
  const currentTile = mapGrid.tiles[gridKey(x, y)];
  if (currentTile && tileBelow && isTileType(currentTile, 2 /* HBoundary */) && isTileType(tileBelow, 2 /* HBoundary */)) return true;
  if (tileBelow) {
    if (isTileType(tileBelow, 32 /* BossCover */) || isTileType(tileBelow, 64 /* BossOrigin */) || isTileType(tileBelow, 8 /* HalfCover */) || isTileType(tileBelow, 16 /* FullCover */))
      return true;
  }
  if (dollGrid) {
    const doll = dollGrid.find((doll2) => doll2.x === x && doll2.y === y + 1);
    if (doll) return true;
  }
  return false;
}
function distance(dollGrid) {
  const bossCoords = getBoss();
  let min = Infinity;
  let minDoll = null;
  let max = -Infinity;
  let maxDoll = null;
  for (const doll of dollGrid) {
    if (doll.instanceId) continue;
    const dist = Math.abs(doll.x - bossCoords.x) + Math.abs(doll.y - bossCoords.y);
    const isHigherPriority = () => doll.priority < (minDoll?.priority ?? Infinity) || doll.borrow;
    if (dist < min || dist === min && isHigherPriority()) {
      min = dist;
      minDoll = doll;
    }
    if (dist > max || dist === max && isHigherPriority()) {
      max = dist;
      maxDoll = doll;
    }
  }
  if (minDoll) minDoll.distance = "near";
  if (maxDoll) maxDoll.distance = "far";
}
function getDollData(drag2, currentTab) {
  const dolls = [];
  state.selectedDolls.forEach((doll) => {
    const pos = state.tabData[currentTab]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
    const oldPos = state.tabData[currentTab - 1]?.dollPositions[doll.id] ?? { x: -1, y: -1 };
    if (pos.x === -1 || pos.y === -1) return;
    const spawnPosition = getDollStartingPosition(doll.id, null);
    const priorityIndex = mapGrid.priority.indexOf(spawnPosition);
    dolls.push({
      x: pos.x,
      y: pos.y,
      oldX: oldPos.x,
      oldY: oldPos.y,
      id: doll.id,
      instanceId: null,
      priority: priorityIndex !== -1 ? priorityIndex : mapGrid.priority.length,
      dollInfo: getInfoFromId(doll.id),
      summonInfo: null,
      dragId: drag2?.isActive ? drag2.id : void 0,
      dragInstanceId: drag2?.isActive ? drag2.instanceId : null,
      obscured: obscured(pos.x, pos.y, doll.id, null),
      borrow: doll.borrow || false,
      distance: null
    });
  });
  if (currentTab >= 1) {
    state.tabData[currentTab].summonPositions.forEach((entry) => {
      const summon = getInfoFromId(entry.id);
      if (summon) {
        const oldSummonPosition = state.tabData[currentTab - 1]?.summonPositions.find((e) => e.mapId === entry.mapId);
        dolls.push({
          x: entry.x,
          y: entry.y,
          oldX: oldSummonPosition?.x ?? -1,
          oldY: oldSummonPosition?.y ?? -1,
          id: entry.id,
          instanceId: entry.mapId,
          priority: mapGrid.priority.length,
          dollInfo: getInfoFromId(summon.dollId),
          summonInfo: summon,
          dragId: drag2?.isActive ? drag2.id : void 0,
          dragInstanceId: drag2?.isActive ? drag2.instanceId : null,
          obscured: obscured(entry.x, entry.y, entry.id, entry.mapId),
          borrow: false,
          distance: null
        });
      }
    });
  }
  for (const [_grid, entry] of Object.entries(dolls)) {
    entry.obscured = obscured(entry.x, entry.y, entry.id, entry.instanceId, dolls);
  }
  distance(dolls);
  return dolls;
}
function drawMapTilesOnArena(ctx3, drag2, currentTab) {
  const dolls = getDollData(drag2, currentTab);
  for (let row = 0; row < mapGrid.size; row++) for (let col = 0; col < mapGrid.size; col++) drawFloor(ctx3, col, row);
  for (let row = 0; row < mapGrid.size; row++) {
    for (let col = 0; col < mapGrid.size; col++) {
      const cell = mapGrid.tiles[gridKey(col, row)];
      const cellBelow = mapGrid.tiles[gridKey(col, row + 1)];
      const cellRight = mapGrid.tiles[gridKey(col + 1, row)];
      const doll = dolls.find((doll2) => doll2.x === col && doll2.y === row);
      if (currentTab < 1) {
        if (isTileType(cell, 1 /* Spawn */)) drawSpawn(ctx3, col, row);
      }
      if (doll) {
        drawDollOnCanvas(ctx3, doll);
      }
      if (!cell) continue;
      if (isTileType(cell, 2 /* HBoundary */) && isTileType(cellBelow, 2 /* HBoundary */)) drawHBoundary(ctx3, col, row);
      if (isTileType(cell, 4 /* VBoundary */) && isTileType(cellRight, 4 /* VBoundary */)) drawVBoundary(ctx3, col, row);
      if (isTileType(cell, 64 /* BossOrigin */)) drawBoss(ctx3, col, row);
      else if (isTileType(cell, 8 /* HalfCover */)) drawHalfCover(ctx3, col, row);
      else if (isTileType(cell, 16 /* FullCover */)) drawFullCover(ctx3, col, row);
    }
  }
  for (let row = 0; row < mapGrid.size; row++) {
    for (let col = 0; col < mapGrid.size; col++) {
      const doll = dolls.find((doll2) => doll2.x === col && doll2.y === row);
      if (doll) {
        drawDollLabelOnCanvas(ctx3, doll);
      }
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
  if (data.summonInfo) {
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
    ctx3.strokeStyle = "#2dd4bf";
    ctx3.lineWidth = 2;
    ctx3.stroke();
  }
}
function drawDollLabelOnCanvas(ctx3, data) {
  if (!data.dollInfo) return;
  const cx = Math.round(data.x * TILE_SIZE + TILE_SIZE / 2);
  const cy = Math.round(data.y * TILE_SIZE + TILE_SIZE / 2);
  const r = Math.round(TILE_SIZE * 0.475);
  const avatarOffY = Math.round(TILE_SIZE * 0.06);
  const fontSize = Math.max(7, Math.round(TILE_SIZE * 0.28));
  ctx3.font = `bold ${fontSize}px Roboto, sans-serif`;
  ctx3.textAlign = "center";
  ctx3.textBaseline = "top";
  let labelY = Math.round(cy + r - avatarOffY + 1);
  if (data.obscured) {
    labelY = Math.round(cy - r - avatarOffY + 1 - fontSize - 2);
  }
  let text = data.dollInfo.name;
  let color = "#ffffff";
  if (data.summonInfo) {
    text = data.summonInfo.name;
    color = "#2dd4bf";
  }
  const labelW = Math.ceil(ctx3.measureText(text).width) + 4;
  ctx3.fillStyle = "rgba(0,0,0,0.75)";
  ctx3.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
  ctx3.fillStyle = color;
  ctx3.fillText(text, cx, labelY + 1);
  if ((data.distance === "near" || data.distance === "far") && mapGrid.name === "Blade Guard Titan") {
    ctx3.beginPath();
    ctx3.arc(cx - avatarOffY - fontSize / 1.5, cy + avatarOffY + fontSize / 1.5, fontSize / 1.5, 0, Math.PI * 2);
    if (data.distance === "near") {
      ctx3.fillStyle = "#0E76A1";
      ctx3.fill();
      ctx3.fillStyle = color;
      ctx3.fillText("C", cx - avatarOffY - fontSize / 1.5, cy + avatarOffY + fontSize / 3);
    } else if (data.distance === "far") {
      ctx3.fillStyle = "#FF6F19";
      ctx3.fill();
      ctx3.fillStyle = color;
      ctx3.fillText("F", cx - avatarOffY - fontSize / 1.5, cy + avatarOffY + fontSize / 3);
    }
  }
}
function drawGhostOnCanvas(ctx3, drag2) {
  const info = getInfoFromId(drag2.id);
  if (!info) return;
  let cx = Math.round(drag2.currentTileX * TILE_SIZE + TILE_SIZE / 2);
  let cy = Math.round(drag2.currentTileY * TILE_SIZE + TILE_SIZE / 2);
  if (drag2.status === 2 /* Swap */) {
    cx = Math.round(drag2.currentTileX * TILE_SIZE + TILE_SIZE / 4);
    cy = Math.round(drag2.currentTileY * TILE_SIZE + TILE_SIZE / 4);
  }
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
  if (drag2.status === 2 /* Swap */) {
    ctx3.strokeStyle = "#EFEFEF";
  } else if (drag2.status === 0 /* Valid */) {
    ctx3.strokeStyle = "#2dd4bf";
  } else {
    ctx3.strokeStyle = "#D42D43";
  }
  ctx3.lineWidth = 2;
  ctx3.stroke();
  if (drag2.status === 3 /* Discard */) {
    ctx3.strokeStyle = "#D42D43";
    ctx3.beginPath();
    ctx3.moveTo(drag2.currentTileX * TILE_SIZE, drag2.currentTileY * TILE_SIZE);
    ctx3.lineTo(drag2.currentTileX * TILE_SIZE + TILE_SIZE, drag2.currentTileY * TILE_SIZE + TILE_SIZE);
    ctx3.stroke();
    ctx3.beginPath();
    ctx3.moveTo(drag2.currentTileX * TILE_SIZE + TILE_SIZE, drag2.currentTileY * TILE_SIZE);
    ctx3.lineTo(drag2.currentTileX * TILE_SIZE, drag2.currentTileY * TILE_SIZE + TILE_SIZE);
    ctx3.stroke();
  }
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
  if (drag2.status === 2 /* Swap */) {
    ctx3.fillText("Swap", cx, labelY + 1);
  } else {
    ctx3.fillText(info.name, cx, labelY + 1);
  }
}

// src/components/icons/Discard.tsx
var _tmpl$ = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 30 30"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(0.923077,-9.42036e-19,1.11332e-18,-1.1,-7.61538,39.4)><path d=M22.333,24L22.333,29.909L26.667,29.909L26.667,24L31,24L24.5,19L18,24L22.333,24Z style=fill:rgb(235,235,235)></path></g><g transform=matrix(1,0,0,1,-9.5,-6.5)><path d=M37,30L12,30L12,20L15,20L15,27L34,27L34,20L37,20L37,30Z style=fill:rgb(235,235,235)>`);
function Discard() {
  return _tmpl$();
}

// src/components/modals/Modal.tsx
var _tmpl$2 = /* @__PURE__ */ template(`<div class="mb-1.75 flex flex-col"><h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]"></h2><div class="mt-1.75 border-t-3 border-[#B5B5B6]">`);
var _tmpl$22 = /* @__PURE__ */ template(`<div><div class="flex h-full w-full flex-col overflow-hidden border-2 border-[#B1AFB3] px-1.5 py-1.75">`);
function Modal(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$22(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$3 = _tmpl$2(), _el$4 = _el$3.firstChild;
        insert(_el$4, () => props.title);
        return _el$3;
      }
    }), null);
    insert(_el$2, resolved, null);
    createRenderEffect(() => className(_el$, `${props.width ?? "w-225"} ${props.hide ? "hidden" : ""} overflow-hidden rounded-sm border-4 border-[#CFCED2] bg-[#CFCED2] shadow-2xl`));
    return _el$;
  })();
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
var _tmpl$23 = /* @__PURE__ */ template(`<button><span>`);
function Button(props) {
  return (() => {
    var _el$ = _tmpl$23(), _el$3 = _el$.firstChild;
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
      var _v$ = props.disabled, _v$2 = `${props.color === "dark" ? "bg-[#1C2A32] text-[#EFEFEF]" : props.color === "light" ? "bg-[#C9C8CE] text-[#1C2A32]" : props.color === "red" ? "bg-[#944040] text-[#EFEFEF]" : ""} ${props.design === "custom" ? "h-12 max-w-87.5 px-6.5" : "h-14 max-w-87.5 min-w-60"} relative flex flex-row items-center overflow-hidden rounded-sm text-xl font-bold whitespace-nowrap shadow-sm shadow-black/50 ${props.disabled ? " opacity-50 cursor-default" : "cursor-pointer outline-3 outline-transparent transition transition-discrete duration-250 hover:outline-white hover:duration-0"}`, _v$3 = `grow ${props.design === "custom" ? "pr-0" : "pr-4"}`;
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
var _tmpl$24 = /* @__PURE__ */ template(`<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">`);
function SmallDollChip(props) {
  const interactive = typeof props.onClick !== "undefined" || typeof props.onDragStart !== "undefined" || typeof props.onPointerDown !== "undefined";
  return (() => {
    var _el$ = _tmpl$18(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$2.nextSibling;
    addEventListener(_el$, "pointerdown", props.onPointerDown, true);
    addEventListener(_el$, "dragstart", props.onDragStart);
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$6 = _tmpl$24();
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
delegateEvents(["click", "pointerdown"]);

// src/components/modals/FullScreen.tsx
var _tmpl$19 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90">`);
function FullScreen(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$19();
    insert(_el$, resolved);
    return _el$;
  })();
}

// src/components/modals/ModalHeader.tsx
var _tmpl$20 = /* @__PURE__ */ template(`<div class="mb-1.75 flex flex-col"><h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]"></h2><div class="mt-1.75 border-t-3 border-[#B5B5B6]">`);
function ModalHeader(props) {
  return (() => {
    var _el$ = _tmpl$20(), _el$2 = _el$.firstChild;
    insert(_el$2, () => props.title);
    return _el$;
  })();
}

// src/components/modals/ModalFooter.tsx
var _tmpl$21 = /* @__PURE__ */ template(`<div class="flex flex-col"><div class="my-1.75 border-t-3 border-[#B5B5B6]"></div><div>`);
function ModalFooter(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$21(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    insert(_el$3, resolved);
    createRenderEffect(() => className(_el$3, `flex px-4 py-4 pt-2.25 ${props.styles}`));
    return _el$;
  })();
}

// src/components/modals/ConfirmModal.tsx
var _tmpl$25 = /* @__PURE__ */ template(`<div class="text-md justify-center text-center font-bold text-[#1C2A32]">`);
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
                    var _el$ = _tmpl$25();
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
    }
  }, {
    defer: true
  }));
  const onFocusIn = () => setIsActive(true);
  const onFocusOut = () => {
    setIsActive(false);
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
var _tmpl$26 = /* @__PURE__ */ template(`<div>`);
var _tmpl$222 = /* @__PURE__ */ template(`<div class=solid-select-control>`);
var _tmpl$32 = /* @__PURE__ */ template(`<div class=solid-select-placeholder>`);
var _tmpl$42 = /* @__PURE__ */ template(`<div class=solid-select-single-value>`);
var _tmpl$52 = /* @__PURE__ */ template(`<div class=solid-select-multi-value><span></span><button type=button class=solid-select-multi-value-remove>\u2A2F`);
var _tmpl$62 = /* @__PURE__ */ template(`<input class=solid-select-input type=text tabindex=0 autocomplete=off autocapitalize=none autocorrect=off size=1>`);
var _tmpl$72 = /* @__PURE__ */ template(`<div class=solid-select-list>`);
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
    var _el$ = _tmpl$26();
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
    var _el$3 = _tmpl$32();
    insert(_el$3, () => props.children);
    return _el$3;
  })();
};
var SingleValue = (props) => {
  return (() => {
    var _el$4 = _tmpl$42();
    insert(_el$4, () => props.children);
    return _el$4;
  })();
};
var MultiValue = (props) => {
  useSelect();
  return (() => {
    var _el$5 = _tmpl$52(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
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
    var _el$8 = _tmpl$62();
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
      var _el$9 = _tmpl$72();
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

// src/components/SetupSidebar.tsx
var _tmpl$27 = /* @__PURE__ */ template(`<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Summons (drag to map)`);
var _tmpl$28 = /* @__PURE__ */ template(`<div class="flex flex-wrap gap-3">`);
var _tmpl$33 = /* @__PURE__ */ template(`<div><div class="flex flex-col items-center gap-3 pt-1 text-sm font-bold text-[#384B53]"><div class="flex flex-row gap-2"></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Echelon (drag to map)</div><div class="flex flex-wrap gap-3"></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">State Management</div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#AE4749] font-bold tracking-wide text-[#ECECEC]">Danger Zone`);
function SetupSidebar(props) {
  const isActionTab = createMemo(() => state.currentTab >= 1 && state.currentTab <= 7);
  const availableSummonIds = createMemo(() => isActionTab() ? getSummonIdsFromDollIds(state.selectedDolls.map((d) => d.id)) : []);
  const [showClearSkillModal, setShowClearSkillModal] = createSignal(false);
  const [showClearTurnModal, setShowClearTurnModal] = createSignal(false);
  const [showClearDataModal, setShowClearDataModal] = createSignal(false);
  const openDollSelector = () => {
    setupTempSelectedDolls();
    const nums = {};
    state.selectedDolls.forEach((d) => {
      nums[d.id] = d.fortification;
    });
    setDollFortification(nums);
    setActivePhaseTab("All");
    setShowDollModal(true);
  };
  const openFormation = () => {
    setupTempSelectedDolls();
    const nums = {};
    state.selectedDolls.forEach((d) => {
      nums[d.id] = d.fortification;
    });
    setDollFortification(nums);
    setShowFormationModal(true);
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
    var _el$ = _tmpl$33(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.nextSibling, _el$8 = _el$5.nextSibling, _el$9 = _el$8.nextSibling;
    insert(_el$2, createComponent(Select, {
      "class": "custom",
      get options() {
        return mapNames();
      },
      onChange: (value) => {
        if (value !== state.map) {
          loadMap(value);
          saveToLocalStorage();
        }
      },
      get initialValue() {
        return state.map;
      }
    }), _el$3);
    insert(_el$3, createComponent(Button, {
      color: "dark",
      onClick: openDollSelector,
      design: "custom",
      content: "Select Dolls"
    }), null);
    insert(_el$3, createComponent(Button, {
      color: "dark",
      onClick: openFormation,
      design: "custom",
      content: "Change Equip"
    }), null);
    insert(_el$2, createComponent(Button, {
      color: "dark",
      onClick: () => setShowBuffModal(true),
      design: "custom",
      content: "Select Support Buff"
    }), _el$4);
    insert(_el$5, createComponent(For, {
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
          onPointerDown: (e) => {
            e.preventDefault();
            deployFromSetupPanel(doll.id, null, e);
          }
        });
      }
    }));
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isActionTab())() && availableSummonIds().length > 0;
      },
      get children() {
        return [_tmpl$27(), (() => {
          var _el$7 = _tmpl$28();
          insert(_el$7, createComponent(For, {
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
                onPointerDown: (e) => {
                  e.preventDefault();
                  deployFromSetupPanel(summonId, `s${state.tabData[state.currentTab].summonPositions.length}`, e);
                }
              });
            }
          }));
          return _el$7;
        })()];
      }
    }), _el$8);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowSkillDisplayModal(true),
      color: "dark",
      design: "custom",
      content: "Set Skill Display"
    }), _el$9);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowExportModal(true),
      color: "dark",
      design: "custom",
      content: "Export Transcript"
    }), _el$9);
    insert(_el$2, createComponent(Button, {
      onClick: () => setShowImportModal(true),
      color: "dark",
      design: "custom",
      content: "Import Transcript"
    }), _el$9);
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

// src/components/icons/SkillIcon.tsx
var _tmpl$29 = /* @__PURE__ */ template(`<div class="skill-icon shrink-0 cursor-pointer"><img>`);
function SkillIcon(props) {
  return (() => {
    var _el$ = _tmpl$29(), _el$2 = _el$.firstChild;
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
var _tmpl$30 = /* @__PURE__ */ template(`<div class="absolute top-0.5 left-0.5 h-4 w-4">`);
var _tmpl$210 = /* @__PURE__ */ template(`<div class="absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class="overflow-hidden overflow-ellipsis whitespace-nowrap">`);
var _tmpl$34 = /* @__PURE__ */ template(`<div><div class="relative flex justify-center overflow-hidden bg-[#909597]"><img loading=lazy>`, true, false, false);
var _tmpl$43 = /* @__PURE__ */ template(`<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">`);
function SquareDollChip(props) {
  const interactive = typeof props.onClick !== "undefined";
  return (() => {
    var _el$ = _tmpl$34(), _el$2 = _el$.firstChild, _el$4 = _el$2.firstChild;
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
        var _el$3 = _tmpl$30();
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
        var _el$5 = _tmpl$210(), _el$6 = _el$5.firstChild;
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
delegateEvents(["click"]);

// src/components/ActionSidebar.tsx
var _tmpl$31 = /* @__PURE__ */ template(`<button class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">Up`);
var _tmpl$211 = /* @__PURE__ */ template(`<button class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">Down`);
var _tmpl$35 = /* @__PURE__ */ template(`<div><div class="flex flex-col gap-1.5 border-2 border-[#D7D7D7] p-1"><div class="drag-grip flex items-center gap-2"><div class="flex flex-col gap-0.5"></div><div class="min-w-0 flex-1"><div class="mt-1 flex flex-wrap gap-1"></div></div></div><div class="flex flex-wrap gap-1.5">`);
var _tmpl$44 = /* @__PURE__ */ template(`<div class="group relative"><div class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 hover:bg-red-900 hover:text-red-300"title=Remove>`);
var _tmpl$53 = /* @__PURE__ */ template(`<div>`);
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
  setState(produce((s) => {
    s.tabData[s.currentTab].actions[dollId]?.splice(actionIdx, 1);
  }));
  saveToLocalStorage();
}
function UpButton(props) {
  return (() => {
    var _el$ = _tmpl$31();
    _el$.$$click = () => {
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
    return _el$;
  })();
}
function DownButton(props) {
  return (() => {
    var _el$2 = _tmpl$211();
    _el$2.$$click = () => {
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
    return _el$2;
  })();
}
function DollRow(props) {
  const dollInfo = getInfoFromId(props.dollId);
  const placed = createMemo(() => isPlaced(props.dollId));
  const actions = createMemo(() => state.tabData[state.currentTab]?.actions[props.dollId] ?? []);
  const skills = dollInfo ? getSortedUsableSkills(dollInfo) : [];
  return (() => {
    var _el$3 = _tmpl$35(), _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$5.nextSibling;
    insert(_el$6, createComponent(Show, {
      get when() {
        return state.tabData[state.currentTab]?.actionOrder?.indexOf(props.dollId) !== 0;
      },
      get children() {
        return createComponent(UpButton, {
          get dollId() {
            return props.dollId;
          }
        });
      }
    }), null);
    insert(_el$6, createComponent(Show, {
      get when() {
        return state.tabData[state.currentTab]?.actionOrder?.indexOf(props.dollId) !== state.tabData[state.currentTab]?.actionOrder?.length - 1;
      },
      get children() {
        return createComponent(DownButton, {
          get dollId() {
            return props.dollId;
          }
        });
      }
    }), null);
    insert(_el$5, createComponent(SquareDollChip, {
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
      _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$3, "data-doll-id", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$3;
  })();
}
function ActionSidebar(props) {
  const actionOrder = createMemo(() => {
    if (state.currentTab < 0 || state.currentTab > 7) return [];
    return state.tabData[state.currentTab]?.actionOrder ?? [];
  });
  return (() => {
    var _el$10 = _tmpl$53();
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
delegateEvents(["click"]);

// src/components/ArenaCanvas.tsx
var _tmpl$36 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75"><button><span>Setup</span></button><button><span>Doll Actions`);
var _tmpl$212 = /* @__PURE__ */ template(`<div><div class="flex flex-1 touch-none"><canvas></canvas><div class="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs text-lime-400"></div><div><div class="h-10 w-10"></div><span class="text-center text-lg leading-tight font-bold text-[#f87171]">Remove</span></div></div><div class="absolute top-3.75 bottom-3.75 left-3.75 z-10 flex">`);
var canvasEl;
var ctx;
var dpr = 1;
var camera = {
  x: 10,
  y: 10,
  scale: 2
};
var activePointers = /* @__PURE__ */ new Map();
var [activeTab, setActiveTab] = createSignal("setup");
var [discardHover, setDiscardHover] = createSignal(false);
var [drag, setDrag] = createStore({
  id: "",
  instanceId: "",
  screenX: -1,
  screenY: -1,
  currentTileX: -1,
  currentTileY: -1,
  status: 0 /* Valid */,
  isActive: false
});
function handlePointerDown(e) {
  e.preventDefault();
  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });
  if (activePointers.size === 1) {
    const world = screenToWorld(e.clientX, e.clientY);
    const hit = getObjectAtWorld(world.tileX, world.tileY);
    if (hit) {
      setDrag(produce((d) => {
        d.id = hit.id;
        d.instanceId = hit.instanceId;
        d.screenX = e.clientX;
        d.screenY = e.clientY;
        d.currentTileX = hit.currentTileX;
        d.currentTileY = hit.currentTileY;
        d.isActive = true;
        d.status = getDragStatus(world.tileX, world.tileY, hit.id, hit.instanceId);
      }));
    }
  } else {
    setDrag(produce((d) => {
      d.isActive = false;
    }));
  }
}
function handlePointerMove(e) {
  e.preventDefault();
  const world = screenToWorld(e.clientX, e.clientY);
  setCoords(`${String(world.tileX).padStart(2, "0")},${String(world.tileY).padStart(2, "0")}`);
  if (activePointers.size < 1 || activePointers.size > 2) return;
  const previousPointers = new Map(activePointers);
  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });
  if (activePointers.size === 1) {
    if (drag.isActive) {
      updateDragInfo(e.clientX, e.clientY);
    } else {
      const prev = previousPointers.get(e.pointerId);
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      camera.x -= dx / camera.scale;
      camera.y -= dy / camera.scale;
      clampCamera();
    }
  } else {
    const [idA, idB] = activePointers.keys();
    const currA = activePointers.get(idA);
    const currB = activePointers.get(idB);
    const prevA = previousPointers.get(idA);
    const prevB = previousPointers.get(idB);
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
function handlePointerUp(e) {
  e.preventDefault();
  e.stopPropagation();
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) {
    AddDollToMap(drag);
    setDrag(produce((d) => {
      d.isActive = false;
    }));
  }
}
function deployFromSetupPanel(id, instanceId, e) {
  e.preventDefault();
  canvasEl.setPointerCapture(e.pointerId);
  activePointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });
  if (activePointers.size === 1) {
    const world = screenToWorld(e.clientX, e.clientY);
    setDrag(produce((d) => {
      d.id = id;
      d.instanceId = instanceId;
      d.screenX = e.clientX;
      d.screenY = e.clientY;
      d.currentTileX = world.tileX;
      d.currentTileY = world.tileY;
      d.isActive = true;
      d.status = getDragStatus(world.tileX, world.tileY, id, instanceId);
    }));
  }
  const onMove = (ev) => {
    if (drag.isActive) {
      updateDragInfo(ev.clientX, ev.clientY);
    }
  };
  const onUp = (ev) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    handlePointerUp(ev);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
function handleDiscardEnter(e) {
  e.preventDefault();
  if (!drag.isActive) return;
  setDiscardHover(true);
}
function handleDiscardLeave(e) {
  e.preventDefault();
  setDiscardHover(false);
}
function handleWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  zoomAt(e.clientX, e.clientY, factor);
}
function zoomAt(clientX, clientY, factor) {
  const before = screenToWorld(clientX, clientY);
  camera.scale *= factor;
  clampCamera();
  const after = screenToWorld(clientX, clientY);
  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  clampCamera();
}
function clampCamera() {
  const MAP_BOUNDS2 = {
    minX: 0,
    minY: 0,
    maxX: mapGrid.size * TILE_SIZE,
    maxY: mapGrid.size * TILE_SIZE
  };
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const minScale = minScaleForBounds();
  camera.scale = Math.max(minScale, Math.min(MAX_SCALE, camera.scale));
  const halfW = cssW / 2 / camera.scale;
  const halfH = cssH / 2 / camera.scale;
  camera.x = Math.max(
    MAP_BOUNDS2.minX - halfW + TILE_SIZE,
    // left limit: left edge + one tile
    Math.min(
      MAP_BOUNDS2.maxX + halfW - TILE_SIZE,
      // right limit: right edge - one tile
      camera.x
    )
  );
  camera.y = Math.max(MAP_BOUNDS2.minY - halfH + TILE_SIZE, Math.min(MAP_BOUNDS2.maxY + halfH - TILE_SIZE, camera.y));
}
function minScaleForBounds() {
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const scaleX = cssW / (mapGrid.size * TILE_SIZE);
  const scaleY = cssH / (mapGrid.size * TILE_SIZE);
  return Math.max(MIN_SCALE, Math.min(scaleX, scaleY));
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
  if (drag.isActive) {
    drawGhostOnCanvas(ctx, drag);
  }
}
function applyCamera() {
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const s = camera.scale * dpr;
  const tx = (cssW / 2 - camera.x * camera.scale) * dpr;
  const ty = (cssH / 2 - camera.y * camera.scale) * dpr;
  ctx.setTransform(s, 0, 0, s, tx, ty);
}
function loop() {
  draw();
  requestAnimationFrame(() => loop());
}
function screenToWorld(clientX, clientY) {
  const rect = canvasEl.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  const cssW = canvasEl.width / dpr;
  const cssH = canvasEl.height / dpr;
  const x = (screenX - cssW / 2) / camera.scale + camera.x;
  const y = (screenY - cssH / 2) / camera.scale + camera.y;
  return {
    x,
    tileX: Math.floor(x / TILE_SIZE),
    y,
    tileY: Math.floor(y / TILE_SIZE)
  };
}
function getDragStatus(tileX, tileY, id, instanceId) {
  if (discardHover()) return 3 /* Discard */;
  const cell = mapGrid.tiles[gridKey(tileX, tileY)];
  const isSetup = state.currentTab === 0;
  const isSpawnTile = isTileType(cell, 1 /* Spawn */);
  const inBounds = tileX >= 0 && tileX < MAP_SIZE && tileY >= 0 && tileY < MAP_SIZE;
  const isBlocked = isTileType(cell, 8 /* HalfCover */) || isTileType(cell, 16 /* FullCover */) || isTileType(cell, 32 /* BossCover */) || isTileType(cell, 64 /* BossOrigin */);
  if (!inBounds || isSetup && !isSpawnTile || !isSetup && isBlocked) return 1 /* Blocked */;
  const tab = state.tabData[state.currentTab];
  for (const [dollId, pos] of Object.entries(tab.dollPositions)) {
    if (pos.x === tileX && pos.y === tileY && dollId !== id) return 2 /* Swap */;
  }
  for (const summon of tab.summonPositions) {
    if (summon.x === tileX && summon.y === tileY && summon.id !== id && summon.mapId !== instanceId) return 2 /* Swap */;
  }
  return 0 /* Valid */;
}
function AddDollToMap(drag2) {
  if (!drag2.id) return;
  if (drag2.status === 3 /* Discard */) {
    removeDollOrSummon(drag2.id, drag2.instanceId);
  } else if (drag2.status === 2 /* Swap */) {
    const swapDoll = getObjectAtWorld(drag2.currentTileX, drag2.currentTileY);
    swapPositions(drag2.id, drag2.instanceId, drag2.currentTileX, drag2.currentTileY, swapDoll);
  } else if (drag2.status === 0 /* Valid */) {
    if (drag2.instanceId) {
      placeSummon(drag2.id, drag2.instanceId, drag2.currentTileX, drag2.currentTileY);
    } else {
      placeDoll(drag2.id, drag2.currentTileX, drag2.currentTileY);
    }
  }
}
function updateDragInfo(clientX, clientY) {
  if (drag.isActive === false) return;
  const world = screenToWorld(clientX, clientY);
  setDrag(produce((d) => {
    d.screenX = clientX;
    d.screenY = clientY;
    d.currentTileX = world.tileX;
    d.currentTileY = world.tileY;
    d.status = getDragStatus(world.tileX, world.tileY, drag.id, drag.instanceId);
  }));
}
function getObjectAtWorld(tileX, tileY) {
  const tab = state.tabData[state.currentTab];
  for (const [dollId, position] of Object.entries(tab.dollPositions)) {
    if (position.x === tileX && position.y === tileY) {
      return {
        id: dollId,
        instanceId: null,
        currentTileX: position.x,
        currentTileY: position.y
      };
    }
  }
  for (const position of tab.summonPositions) {
    if (position.x === tileX && position.y === tileY) {
      return {
        id: position.id,
        instanceId: position.mapId,
        currentTileX: position.x,
        currentTileY: position.y
      };
    }
  }
  return null;
}
function bindResize() {
  window.addEventListener("resize", () => fitToWindow());
  window.matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", () => fitToWindow());
  fitToWindow();
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
function ArenaCanvas() {
  onMount(() => {
    ctx = canvasEl.getContext("2d");
    bindResize();
    loop();
  });
  const isSetupTab = () => activeTab() === "setup" || state.currentTab === 0;
  const isActionTab = () => activeTab() === "actions" && state.currentTab > 0;
  const isDragActive = () => drag.isActive === true;
  return (() => {
    var _el$ = _tmpl$212(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$2.nextSibling;
    _el$2.$$pointerup = handlePointerUp;
    _el$2.$$pointermove = handlePointerMove;
    _el$2.$$pointerdown = handlePointerDown;
    _el$2.addEventListener("wheel", handleWheel);
    var _ref$ = canvasEl;
    typeof _ref$ === "function" ? use(_ref$, _el$3) : canvasEl = _el$3;
    insert(_el$4, () => coords() || "00,00");
    _el$5.addEventListener("pointerleave", handleDiscardLeave);
    _el$5.addEventListener("pointerenter", handleDiscardEnter);
    insert(_el$6, createComponent(Discard, {}));
    insert(_el$7, createComponent(Modal, {
      width: "w-96",
      get children() {
        return [(() => {
          var _el$8 = _tmpl$36(), _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling;
          _el$9.$$click = () => {
            setActiveTab("setup");
          };
          _el$0.$$click = () => {
            setActiveTab("actions");
          };
          createRenderEffect((_p$) => {
            var _v$ = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isSetupTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isActionTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"} ${state.currentTab === 0 ? "cursor-not-allowed opacity-50" : ""}`;
            _v$ !== _p$.e && className(_el$9, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$0, _p$.t = _v$2);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$8;
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
    createRenderEffect(() => className(_el$5, `pointer-events-auto absolute top-1/2 right-6 flex -translate-y-1/2 touch-none flex-col items-center justify-center gap-2 rounded-2xl border-3 border-dashed border-[#7f1d1d] bg-[rgba(127,29,29,0.55)] p-6 backdrop-blur-sm select-none ${discardHover() ? "opacity-40" : "opacity-100"} ${isDragActive() ? "" : "pointer-events-none hidden"}`));
    return _el$;
  })();
}
delegateEvents(["pointerdown", "pointermove", "pointerup", "click"]);

// src/store/index.ts
var mapGrid = { name: "Default", size: 21, priority: [], tiles: [] };
function gridKey(column, row, size) {
  return row * (size ?? mapGrid.size) + column;
}
function cellX(c) {
  return c * TILE_SIZE;
}
function cellY(r) {
  return r * TILE_SIZE;
}
function inMapBounds(c, r) {
  return c >= 0 && c < mapGrid.size && r >= 0 && r < mapGrid.size;
}
function isTileType(tile, type) {
  return (tile & type) === type;
}
function getCell(column, row) {
  if (row > mapGrid.size || column > mapGrid.size) {
    console.error("Out of bound tile", column, row, mapGrid.size);
    return 0 /* Empty */;
  }
  return mapGrid.tiles[row * mapGrid.size + column];
}
function getBoss() {
  const bossIndex = mapGrid.tiles.findIndex((tile) => isTileType(tile, 64 /* BossOrigin */));
  if (bossIndex > -1) {
    return { x: bossIndex % mapGrid.size, y: Math.floor(bossIndex / mapGrid.size) };
  }
  return { x: 0, y: 0 };
}
function hasCover(c, r) {
  if (!inMapBounds(c, r)) return false;
  const cell = mapGrid.tiles[gridKey(c, r)];
  return isTileType(cell, 16 /* FullCover */) || isTileType(cell, 8 /* HalfCover */) || isTileType(cell, 32 /* BossCover */) || isTileType(cell, 64 /* BossOrigin */);
}
function setMap(name, size, tiles, priority) {
  setState("map", name);
  mapGrid.name = name;
  mapGrid.size = size;
  mapGrid.tiles.length = 0;
  mapGrid.priority.length = 0;
  mapGrid.priority.push(...priority);
  mapGrid.tiles.push(...tiles);
  camera.x = mapGrid.size * TILE_SIZE / 2;
  camera.y = mapGrid.size * TILE_SIZE / 2;
}
function setCell(x, y, value, merge) {
  const before = getCell(x, y);
  if (merge) {
    mapGrid.tiles[gridKey(x, y)] = mapGrid.tiles[gridKey(x, y)] | value;
  }
  mapGrid.tiles[gridKey(x, y)] = value;
}
function unsetBoss() {
  for (const [index, tile] of mapGrid.tiles.entries()) {
    if (isTileType(tile, 32 /* BossCover */) || isTileType(tile, 64 /* BossOrigin */)) {
      mapGrid.tiles[index] = mapGrid.tiles[index] & ~32 /* BossCover */;
      mapGrid.tiles[index] = mapGrid.tiles[index] & ~64 /* BossOrigin */;
    }
  }
}
var allDolls = [];
var allSummons = [];
var allKeys = { common: [], affinity: [] };
var allWeapons = [];
var allBuffs = [];
var defaultWeapons = {};
var skillOrder = ["Basic Attack", "Skill 1", "Skill 2", "Skill 3", "Passive", "Skill A", "Skill B", "End Turn", "Move"];
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
  "Skill B": ["S7", "7", "SB", "2"],
  "End Turn": ["ET", "Z", "END"],
  Move: ["MV", "W", "MOVE", "MOV"]
};
var endTurnSkill = {
  id: -1,
  name: "End Turn",
  type: "End Turn",
  range: null,
  tags: [],
  localImagePath: "data/common/end.svg"
};
var [editorTool, setEditorTool] = createSignal("spawn");
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
var [tempSelectedDolls, setTempSelectedDolls] = createStore([]);
var defaultState = {
  selectedDolls: [],
  currentTab: 0,
  score: 0,
  description: "",
  map: "Blade Guard Titan",
  buffs: [],
  skillDisplay: [0, 0, 0, 0, 0, 0, 0],
  tabData: Array.from({ length: 8 }, () => makeDefaultTabData())
};
var [state, setState] = createStore(defaultState);
var [showDollModal, setShowDollModal] = createSignal(false);
var [showFormationModal, setShowFormationModal] = createSignal(false);
var [showWeaponModal, setShowWeaponModal] = createSignal(false);
var [showKeyModal, setShowKeyModal] = createSignal(false);
var [showBuffModal, setShowBuffModal] = createSignal(false);
var hideFormationModal = createMemo(() => showWeaponModal() || showKeyModal());
var [selectedDoll, setSelectedDoll] = createSignal(null);
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
var [stateHashMatch, setStateHashMatch] = createSignal(false);
var [stateFromURL, setStateFromURL] = createSignal(false);
var [zoom, setZoom] = createSignal(2);
var [coords, setCoords] = createSignal("");
var [offsetX, setOffsetX] = createSignal(0);
var [offsetY, setOffsetY] = createSignal(0);
function setupTempSelectedDolls() {
  setTempSelectedDolls(
    produce((selectedDolls) => {
      console.log("Setting up tempSelectedDolls", selectedDolls.length, state.selectedDolls.length);
      selectedDolls.length = 0;
      for (const doll of state.selectedDolls) {
        selectedDolls.push({
          id: doll.id,
          fortification: doll.fortification,
          keys: [...doll.keys],
          remoldingLvl: doll.remoldingLvl,
          gun: doll.gun,
          borrow: doll.borrow ?? false
        });
      }
    })
  );
}
function removeDollFromTempSelect(dollId) {
  setTempSelectedDolls(
    produce((selectedDolls) => {
      const index = selectedDolls.findIndex((doll) => doll.id === dollId);
      if (index > -1) {
        selectedDolls.splice(index, 1);
      }
    })
  );
}
function addDollToTempSelect(dollId) {
  setTempSelectedDolls(
    produce((selectedDolls) => {
      selectedDolls.push({
        id: dollId,
        fortification: 0,
        keys: Array(8).fill(""),
        remoldingLvl: 0,
        gun: "",
        borrow: false
      });
    })
  );
}
function setDollWeapon(dollId, weaponId) {
  if (!weaponId || !dollId) return;
  setTempSelectedDolls(
    produce((selectedDolls) => {
      for (const doll of selectedDolls) {
        if (doll.id === dollId) {
          doll.gun = weaponId;
        }
      }
    })
  );
}
function setBuffs(buffIds) {
  setState(
    produce((s) => {
      s.buffs.length = 0;
      s.buffs.push(...buffIds);
    })
  );
  saveToLocalStorage();
}
function setDollKey(dollId, index, keyId) {
  if (!dollId) return;
  setTempSelectedDolls(
    produce((selectedDolls) => {
      for (const doll of selectedDolls) {
        if (doll.id === dollId) {
          if (keyId === null) {
            doll.keys[index] = "";
          } else {
            doll.keys[index] = keyId;
          }
        }
      }
    })
  );
}
function changeFortification(dollId, fort) {
  setTempSelectedDolls(
    produce((tempSelected2) => {
      const index = tempSelected2.findIndex((d) => d.id === dollId);
      if (index !== -1) {
        tempSelected2[index].fortification += fort;
        tempSelected2[index].fortification = Math.max(0, tempSelected2[index].fortification);
        tempSelected2[index].fortification = Math.min(6, tempSelected2[index].fortification);
      }
    })
  );
}
function changeBorrow(dollId) {
  setTempSelectedDolls(
    produce((tempSelected2) => {
      for (const doll of tempSelected2) {
        doll.borrow = false;
        if (doll.id === dollId) {
          doll.borrow = !doll.borrow;
        }
      }
    })
  );
}
function changeRemoldingLvl(dollId, modifier) {
  const remoldingLevels = [1, 10, 20, 30, 45, 60];
  setTempSelectedDolls(
    produce((tempSelected2) => {
      const index = tempSelected2.findIndex((d) => d.id === dollId);
      if (index !== -1) {
        let currentLvl = remoldingLevels.indexOf(tempSelected2[index].remoldingLvl);
        currentLvl += modifier;
        currentLvl = Math.max(0, currentLvl);
        currentLvl = Math.min(remoldingLevels.length - 1, currentLvl);
        tempSelected2[index].remoldingLvl = remoldingLevels[currentLvl];
      }
    })
  );
}
function saveDollLoadout(dollId) {
  const index = tempSelectedDolls.findIndex((d) => d.id === dollId);
  if (index !== -1) {
    const doll = tempSelectedDolls[index];
    localStorage.setItem(DOLL_LOADOUT_KEY(dollId), JSON.stringify(doll));
  }
}
function loadDollLoadout(dollId) {
  const loadout = localStorageLoad(DOLL_LOADOUT_KEY(dollId));
  setTempSelectedDolls(
    produce((selectedDolls) => {
      for (const doll of selectedDolls) {
        if (doll.id === dollId && loadout) {
          doll.fortification = loadout.fortification;
          doll.keys = [...loadout.keys];
          doll.remoldingLvl = loadout.remoldingLvl;
          doll.gun = loadout.gun;
          doll.borrow = loadout.borrow ?? false;
        }
      }
    })
  );
}
function dollHasLoadout(dollId) {
  return localStorage.getItem(DOLL_LOADOUT_KEY(dollId)) !== null;
}
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
function getKeyFromId(dollId, keyId, dollInfo) {
  if (!keyId) return void 0;
  const identifier = keyId.charAt(0);
  if (identifier === "k") {
    dollInfo = dollInfo ?? getDollFromId(dollId);
    if (!dollInfo) return void 0;
    return dollInfo.keys.find((k) => k.id === keyId);
  } else if (identifier === "c") {
    return allKeys.common.find((k) => k.id === keyId);
  } else if (identifier === "a") {
    return allKeys.affinity.find((k) => k.id === keyId);
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
function getDollStartingPosition(dollId, instanceId) {
  let pos = gridKey(-1, -1);
  if (instanceId) {
    for (const p of state.tabData[0].summonPositions) {
      if (p.id === dollId && p.mapId === instanceId) {
        pos = gridKey(p.x, p.y);
      }
    }
  }
  const dollPos = state.tabData[0].dollPositions[dollId];
  pos = gridKey(dollPos?.x ?? -1, dollPos?.y ?? -1);
  return pos;
}
function getSortedUsableSkills(doll) {
  const usable = (doll.skills || []).filter((s) => s.type !== "Passive" || s.name === "Escort");
  const basic = usable.filter((s) => s.type === "Basic Attack");
  const endTurn = usable.filter((s) => s.type === "End Turn");
  const numbered = usable.filter((s) => (s.type || "").startsWith("Skill ")).sort((a, b) => parseInt((a.type || "").replace("Skill ", "")) - parseInt((b.type || "").replace("Skill ", "")));
  const rest = usable.filter((s) => !basic.includes(s) && !numbered.includes(s) && !endTurn.includes(s)).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  return [...basic, ...numbered, ...rest, ...endTurn];
}
function isPlaced(dollId) {
  for (const p of state.tabData[state.currentTab].summonPositions) {
    if (p.id === dollId) return true;
  }
  const pos = state.tabData[state.currentTab].dollPositions[dollId];
  return !!pos && pos.x > -1;
}
function getDollPosition(dollId, instanceId) {
  const positions = [];
  for (const p of state.tabData[state.currentTab].summonPositions) {
    if (p.id === dollId && p.mapId === instanceId) return { x: p.x, y: p.y };
  }
  const pos = state.tabData[state.currentTab].dollPositions[dollId];
  if (pos) return pos;
  return null;
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
function displaySmallKeys(dollId, keys) {
  const blankCommonKey = { type: "Common Key", rarity: "None" };
  const blankFixedKey = { type: "Fixed Key", rarity: "None" };
  const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
  const doll = getInfoFromId(dollId);
  if (!doll) return [];
  const result = [];
  const sortedKeys = sortEquippedKeys(dollId, keys);
  for (const [index, keyType] of keyMapping.entries()) {
    const keyInfo = sortedKeys[index];
    if (keyType === "Expansion Key") result.push("=");
    if (doll.hasExpansionKey === false && keyType === "Expansion Key") continue;
    if (keyInfo === null) {
      if (keyType === "Fixed Key" || keyType === "Expansion Key") result.push(blankFixedKey);
      else if (keyType === "Common Key" || keyType === "Affinity Key") result.push(blankCommonKey);
    } else {
      result.push(keyInfo);
    }
    if (keyType === "Affinity Key") result.push("=");
  }
  return result;
}
function sortEquippedKeys(dollId, keys) {
  const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
  const result = Array(keyMapping.length).fill(null);
  const doll = getInfoFromId(dollId);
  if (!doll) return result;
  let fixedKeyIndex = keyMapping.indexOf("Fixed Key");
  let commonKeyIndex = keyMapping.indexOf("Common Key");
  const expansionKeyIndex = keyMapping.indexOf("Expansion Key");
  const affinityKeyIndex = keyMapping.indexOf("Affinity Key");
  for (const [index, keyType] of keyMapping.entries()) {
    const keyId = keys[index] ?? "";
    if (keyId === "") {
      continue;
    }
    let keyInfo = getKeyFromId(dollId, keyId, doll);
    if (keyInfo && keyInfo.type === "Fixed Key") {
      result[fixedKeyIndex] = keyInfo;
      fixedKeyIndex += 1;
      continue;
    } else if (keyInfo && keyInfo.type === "Common Key") {
      result[commonKeyIndex] = keyInfo;
      commonKeyIndex += 1;
      continue;
    } else if (keyInfo && keyInfo.type === "Affinity Key") {
      result[affinityKeyIndex] = keyInfo;
      continue;
    } else if (keyInfo && keyInfo.type === "Expansion Key") {
      result[expansionKeyIndex] = keyInfo;
      continue;
    } else {
      console.error("Unable to find key", keyId, doll);
    }
  }
  return result;
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
      s.selectedDolls.length = 0;
      s.selectedDolls.push(...newDolls);
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
      if (added.length || removed.length) {
        s.score = 0;
        s.description = "";
      }
      console.log("Changing selected dolls", added, removed, s.selectedDolls.length);
    })
  );
}
async function updateSelectedDolls() {
  changeSelectedDolls([...tempSelectedDolls]);
  await preloadCanvasImages();
  for (let i = 0; i < 8; i++) defaultActionOrder(i);
  saveToLocalStorage();
}
function saveToLocalStorage() {
  console.log("Saving to localStorage");
  setStateFromURL(false);
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...state }));
}
function saveSkillDisplay() {
  localStorage.setItem(SKILL_DISPLAY_KEY, JSON.stringify({ override: overrideSkillNotations(), skillDisplay: state.skillDisplay }));
}
function compareStateHash(localState) {
  const storedState = localStorageLoad(STORAGE_KEY);
  if (!storedState) return false;
  const clone = structuredClone(unwrap(localState));
  const oldState = {
    selectedDolls: storedState.selectedDolls,
    map: storedState.map,
    buffs: storedState.buffs ?? [],
    tabData: storedState.tabData
  };
  const newState = {
    selectedDolls: clone.selectedDolls,
    map: clone.map,
    buffs: clone.buffs ?? [],
    tabData: clone.tabData
  };
  return JSON.stringify(oldState) === JSON.stringify(newState);
}
function loadState(newData) {
  const incomingState = version7To8Upgrade(newData);
  setState(
    produce((s) => {
      s.selectedDolls = incomingState.selectedDolls;
      s.currentTab = incomingState.currentTab;
      s.map = incomingState.map;
      s.score = incomingState.score ?? 0;
      s.description = incomingState.description ?? "";
      s.buffs = incomingState.buffs ?? [];
      if (incomingState.skillDisplay) {
        s.skillDisplay = incomingState.skillDisplay;
      }
      for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
        const src = incomingState.tabData[tabIndex];
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
  setEditingMap(state.map);
}
function version7To8Upgrade(data) {
  if (data.version !== V7_SAVE_VERSION) return data;
  data.version = 8;
  if (typeof data.actionType === "number") {
    if (data.actionType === 0) {
      data.actionType = "0000000";
    }
    if (data.actionType === 1) {
      data.actionType = "1111111";
    }
    if (data.actionType === 2) {
      data.actionType = "2222222";
    }
  } else if (typeof data.actionType === "string") {
    if (data.actionType.length !== 7) {
      data.actionType = "0000000";
    }
  }
  if (data.actionType && typeof data.actionType === "string" && data.actionType.length === 7) {
    data.skillDisplay.length = 0;
    for (const character of Array.from(data.actionType)) {
      data.skillDisplay.push(parseInt(character));
    }
  }
  delete data.actionType;
  data.map = "Tusk Beasteel";
  data.score = 0;
  data.description = "";
  data.buffs = data.buffs ?? [];
  for (const doll of data.selectedDolls) {
    if (!doll.keys || doll.keys.length !== 8) {
      doll.keys = Array(8).fill("");
    }
    doll.remoldingLvl = doll.remoldingLvl ?? 1;
    doll.fortification = doll.fortification ?? 0;
    doll.gun = doll.gun ?? "";
    doll.borrow = doll.borrow ?? false;
  }
  return data;
}
function localStorageLoad(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item);
  } catch (e) {
    console.error("Error loading from localStorage", e);
    return null;
  }
}
function migrate() {
  if (!localStorage.getItem(V7_STORAGE_KEY)) return;
  if (localStorage.getItem(STORAGE_KEY)) return;
  console.log("Migrating data from version 7 to version 8");
  const v7Data = localStorageLoad(V7_STORAGE_KEY);
  const v7Skills = localStorageLoad(V7_SKILL_DISPLAY_KEY);
  const v7Map = localStorageLoad(V7_EDITOR_MAP_KEY);
  if (v7Data) {
    const upgraded = version7To8Upgrade(v7Data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(upgraded));
  }
  if (v7Skills) {
    localStorage.setItem(SKILL_DISPLAY_KEY, JSON.stringify(v7Skills));
  }
  if (v7Map) {
    localStorage.setItem(CUSTOM_MAP_KEY, JSON.stringify(v7Map));
  }
}
async function importState(processFn, data, fallback = false) {
  const oldState = localStorageLoad(STORAGE_KEY);
  try {
    const appState = await processFn(data);
    if (!appState && fallback && oldState && oldState.version === SAVE_VERSION) {
      alert("Failed to import state, loading old state");
      console.error("Please pass this text to ArkahnX:\n" + data);
      loadState(oldState);
      return;
    }
    if (!appState) {
      alert("Failed to import state and no old state found");
      console.error("Please pass this text to ArkahnX:\n" + data);
      return;
    }
    const migrated = version7To8Upgrade(appState);
    if (migrated.version !== SAVE_VERSION) {
      alert("Unsupported version");
      return;
    }
    loadState(migrated);
    for (let i = 0; i < 8; i++) defaultActionOrder(i);
    await preloadCanvasImages();
    const SkillConfig = localStorageLoad(SKILL_DISPLAY_KEY);
    if (SkillConfig) {
      setOverrideSkillNotations(SkillConfig.override);
      if (SkillConfig.override === true) {
        overrideSkillDisplay(SkillConfig.skillDisplay);
      }
    }
    loadMap(state.map);
    setupTempSelectedDolls();
    console.log("finished loading state");
    if (stateFromURL() === false) {
      saveToLocalStorage();
    }
  } catch (e) {
    alert("Error importing state");
    console.error("Error importing state", e);
    if (fallback && oldState && oldState.version === SAVE_VERSION) {
      loadState(oldState);
      for (let i = 0; i < 8; i++) defaultActionOrder(i);
      await preloadCanvasImages();
      const SkillConfig = localStorageLoad(SKILL_DISPLAY_KEY);
      if (SkillConfig) {
        setOverrideSkillNotations(SkillConfig.override);
        if (SkillConfig.override === true) {
          overrideSkillDisplay(SkillConfig.skillDisplay);
        }
      }
      loadMap(state.map);
      setupTempSelectedDolls();
      console.log("finished loading backup state");
      return;
    }
  }
}
function loadFromLocalStorage(data) {
  return new Promise((resolve) => {
    if (localStorage.getItem(STORAGE_KEY) === null) {
      resolve({ version: SAVE_VERSION, ...defaultState });
    } else {
      resolve(localStorageLoad(STORAGE_KEY));
    }
  });
}
async function loadFromString(data) {
  const decompressed = await decompress(data.trim());
  return JSON.parse(decompressed);
}
async function loadFromWorker(stateId) {
  const cachedState = localStorage.getItem(stateId);
  if (cachedState !== null) {
    const decompressed = await decompress(cachedState);
    return JSON.parse(decompressed);
  }
  const res = await fetch(`https://gunsmoke.arkahnx.technology/state?stateId=${stateId}`);
  const data = await res.json();
  if (data.error) {
    alert(data.error);
  }
  if (data.result) {
    const decompressed = await decompress(data.result.state);
    const savedStates = localStorageLoad(SAVED_STATES_KEY);
    if (!savedStates) {
      localStorage.setItem(SAVED_STATES_KEY, JSON.stringify([stateId]));
    } else {
      savedStates.push(stateId);
      if (savedStates.length > 10) {
        const removedState = savedStates.shift();
        localStorage.removeItem(removedState);
      }
      localStorage.setItem(SAVED_STATES_KEY, JSON.stringify(savedStates));
    }
    localStorage.setItem(stateId, data.result.state);
    return JSON.parse(decompressed);
  }
  return null;
}
function setSkillDisplay(skillType, notationStyle) {
  const index = notations[skillType].indexOf(notationStyle);
  if (state.skillDisplay[skillOrder.indexOf(skillType)] === index) return;
  console.log("Setting skill display", skillType, notationStyle, index, skillOrder.indexOf(skillType));
  setState(
    produce((s) => {
      s.skillDisplay[skillOrder.indexOf(skillType)] = index;
    })
  );
}
function getSkillDisplay(skillType) {
  return notations[skillType][state.skillDisplay[skillOrder.indexOf(skillType)] ?? 0];
}
function overrideSkillDisplay(values) {
  setState(
    produce((s) => {
      s.skillDisplay.length = 0;
      s.skillDisplay.push(...values);
    })
  );
}
function sortBuffs(buffId1, buffId2) {
  const buff1 = typeof buffId1 === "string" ? allBuffs.find((b) => buffId1 === b.id) : buffId1;
  const buff2 = typeof buffId2 === "string" ? allBuffs.find((b) => buffId2 === b.id) : buffId2;
  if (!buff1 || !buff2) return 0;
  return buff2.season - buff1.season || +buff2.core - +buff1.core || buff1.days?.[CURRENT_SEASON]?.[0] - buff2.days?.[CURRENT_SEASON]?.[0] || buff1.name.localeCompare(buff2.name);
}
async function compress(data) {
  const clone = structuredClone(unwrap(data));
  const exportState = {
    version: SAVE_VERSION,
    selectedDolls: clone.selectedDolls,
    currentTab: 8,
    score: clone.score,
    description: clone.description,
    map: clone.map,
    buffs: (clone.buffs ?? []).sort(sortBuffs),
    tabData: clone.tabData
  };
  for (const doll of exportState.selectedDolls) {
    doll.keys.sort();
  }
  const byteArray = new TextEncoder().encode(JSON.stringify(exportState));
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
function swapPositions(id, instanceId, col, row, swapDoll) {
  if (!swapDoll) return;
  setState(
    produce((s) => {
      const oldPosition = getDollPosition(id, instanceId);
      if (!instanceId) {
        s.tabData[s.currentTab].dollPositions[id] = { x: col, y: row };
      } else {
        const positions = s.tabData[s.currentTab].summonPositions;
        const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
        if (existing) {
          existing.x = col;
          existing.y = row;
        } else {
          positions.push({ id, mapId: instanceId, x: col, y: row });
        }
      }
      if (oldPosition) {
        if (!swapDoll.instanceId) {
          s.tabData[s.currentTab].dollPositions[swapDoll.id] = { x: oldPosition.x, y: oldPosition.y };
        } else {
          const positions = s.tabData[s.currentTab].summonPositions;
          const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
          if (existing) {
            existing.x = oldPosition.x;
            existing.y = oldPosition.y;
          }
        }
      } else {
        if (!swapDoll.instanceId) {
          s.tabData[s.currentTab].dollPositions[swapDoll.id] = { x: -1, y: -1 };
        } else {
          const positions = s.tabData[s.currentTab].summonPositions;
          const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
          if (existing) {
            positions.splice(positions.indexOf(existing), 1);
          }
        }
      }
    })
  );
  saveToLocalStorage();
}
function removeDollOrSummon(id, instanceId) {
  if (!id) return;
  if (!instanceId) {
    setState(
      produce((s) => {
        s.tabData[s.currentTab].dollPositions[id] = { x: -1, y: -1 };
      })
    );
    saveToLocalStorage();
    return;
  }
  setState(
    produce((s) => {
      const positions = s.tabData[s.currentTab].summonPositions;
      const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
      if (existing) {
        positions.splice(positions.indexOf(existing), 1);
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
    const res = await Promise.all([fetch("combined.json"), fetch("keys.json"), fetch("weapons.json"), fetch("buffs.json")]);
    const combinedJson = await res[0].json();
    const keysJson = await res[1].json();
    const weaponsJson = await res[2].json();
    const buffsJson = await res[3].json();
    allWeapons.push(...weaponsJson);
    allBuffs.push(...buffsJson);
    for (const weapon of allWeapons) {
      if (weapon.imprintId === null && weapon.rarity === "Elite") {
        defaultWeapons[weapon.type] = weapon;
      }
    }
    for (const buff of allBuffs) {
      buff.core = buff.core ?? false;
    }
    for (const entry of combinedJson) {
      const hasExpansionKey = (entry.keys ?? []).findIndex((key) => key.type === "Expansion Key") > -1;
      const doll = {
        id: entry.id,
        name: entry.name,
        phase: entry.phase,
        avatar: entry.avatar,
        remolding: entry.remolding,
        rarity: entry.rarity,
        gunType: entry.gunType,
        hasSummons: false,
        hasExpansionKey,
        skills: entry.skills ? [...entry.skills, endTurnSkill] : [endTurnSkill],
        keys: entry.keys ? entry.keys : [],
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
            skills: summon.skills ? [...summon.skills, endTurnSkill] : [endTurnSkill]
          });
        }
      }
      allDolls.push(doll);
    }
    for (const key of keysJson.affinity) {
      const dollInfo = allDolls.find((d) => d.id === key.dollId);
      allKeys.affinity.push({
        dollName: dollInfo ? dollInfo.name : "",
        dollAvatar: dollInfo ? dollInfo.avatar : "",
        ...key
      });
    }
    for (const key of keysJson.common) {
      const dollInfo = allDolls.find((d) => d.id === key.dollId);
      allKeys.common.push({ dollName: dollInfo ? dollInfo.name : "", dollAvatar: dollInfo ? dollInfo.avatar : "", ...key });
    }
  } catch (e) {
    console.error(e);
  }
}
var interactiveStyles = (selected = false) => "cursor-pointer outline-3 transition transition-discrete duration-175 hover:scale-107 hover:outline-white " + (selected ? "outline-[#F26C1C]" : "outline-transparent");
function runAfterFramePaint(callback) {
  requestAnimationFrame(() => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = callback;
    messageChannel.port2.postMessage(void 0);
  });
}

// src/components/TabBar.tsx
var _tmpl$37 = /* @__PURE__ */ template(`<div class="flex flex-row gap-1.5 p-1">`);
var _tmpl$213 = /* @__PURE__ */ template(`<div class="flex items-center justify-between gap-1 overflow-x-auto border-t border-[#E06C28] bg-[#C7C5CE] px-4 py-2"><div class="flex gap-3"><button>Map Editor</button><div class="mx-1 h-6 w-px self-center bg-zinc-700"></div><div class="flex gap-0"></div><button>Summary</button></div><div class="flex flex-row items-center gap-2"><div>`);
var _tmpl$38 = /* @__PURE__ */ template(`<button>`);
function TabBar(props) {
  const savedState = "The current state is saved locally.";
  const urlState = "The current state is derived from the URL. Make a change to save it locally.";
  const unsavedState = "The current state is unsaved. Make a change to save it locally.";
  const stateStyle = createMemo(() => {
    if (stateFromURL()) return {
      color: "bg-[#F0AF16]",
      text: urlState
    };
    if (stateHashMatch()) return {
      color: "bg-[#2dd4bf]",
      text: savedState
    };
    return {
      color: "bg-[#AE4749]",
      text: unsavedState
    };
  });
  const switchToTab = (newTab) => {
    setState(produce((s) => {
      s.currentTab = newTab;
    }));
    props.onTabChange(newTab);
  };
  const isActionTab = createMemo(() => state.currentTab >= 1 && state.currentTab <= 7);
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
  return (() => {
    var _el$ = _tmpl$213(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling, _el$7 = _el$2.nextSibling, _el$9 = _el$7.firstChild;
    _el$3.$$click = () => switchToTab(-1);
    insert(_el$5, createComponent(For, {
      get each() {
        return Array.from({
          length: 8
        }, (_, i) => i);
      },
      children: (i) => (() => {
        var _el$0 = _tmpl$38();
        _el$0.$$click = () => switchToTab(i);
        insert(_el$0, i === 0 ? "Setup" : i);
        createRenderEffect(() => className(_el$0, `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${state.currentTab === i ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"}`));
        return _el$0;
      })()
    }));
    _el$6.$$click = () => switchToTab(8);
    insert(_el$7, createComponent(Show, {
      get when() {
        return state.currentTab === 8;
      },
      get children() {
        var _el$8 = _tmpl$37();
        insert(_el$8, createComponent(Button, {
          onClick: () => setShowExportModal(true),
          color: "dark",
          design: "custom",
          content: "Export Transcript"
        }), null);
        insert(_el$8, createComponent(Button, {
          onClick: () => setShowImportModal(true),
          color: "dark",
          design: "custom",
          content: "Import Transcript"
        }), null);
        insert(_el$8, createComponent(Button, {
          onClick: () => setShowSkillDisplayModal(true),
          color: "dark",
          design: "custom",
          content: "Set Skill Display"
        }), null);
        return _el$8;
      }
    }), _el$9);
    insert(_el$7, createComponent(Show, {
      get when() {
        return isActionTab();
      },
      get children() {
        return createComponent(Button, {
          onClick: copyPreviousPlacements,
          color: "dark",
          design: "custom",
          content: "Use Previous Turn Positions"
        });
      }
    }), _el$9);
    createRenderEffect((_p$) => {
      var _v$ = `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold whitespace-nowrap transition-all ${state.currentTab === -1 ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${state.currentTab === 8 ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"}`, _v$3 = `${interactiveStyles(false)} rounded-full w-6 h-6 ${stateStyle().color}`, _v$4 = stateStyle().text;
      _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$6, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$9, _p$.a = _v$3);
      _v$4 !== _p$.o && setAttribute(_el$9, "title", _p$.o = _v$4);
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

// src/components/EditorView.tsx
var _tmpl$39 = /* @__PURE__ */ template(`<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3"><div class="flex-wrap gap-1 rounded-sm bg-[#CFCED2] p-1 text-sm font-bold text-[#325563] shadow-sm shadow-black/50"><div class="flex flex-row items-center gap-1.5 border-2 border-[#B1AFB3] p-1"><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><span class="etl whitespace-nowrap"></span><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><span class=etl>Tool:</span><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Reset</button><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Clear</button><div class="mx-0.5 h-[18px] w-px bg-[#1e2730]"></div><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Export JSON</button><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Import JSON</button></div></div><div class="flex-1 overflow-auto rounded-md"style=line-height:0><canvas style=display:block;cursor:crosshair></canvas></div><p class="mt-1 pl-0.5 text-[#2a3a4a]">`);
var _tmpl$214 = /* @__PURE__ */ template(`<button><span class="h-[11px] w-[11px] flex-shrink-0 rounded-[2px]">`);
var _tmpl$310 = /* @__PURE__ */ template(`<div class="mt-2 flex-shrink-0 rounded-md border border-[#1e2730] bg-[#13181f] p-2"><textarea class="h-[120px] w-full resize-y rounded border border-[#1e2730] bg-[#0c1014] p-1.5 font-mono text-[11px] text-[#6a9a7a]"></textarea><div class="mt-1.5 flex gap-1.5"><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]"></button><button class="cursor-pointer rounded border border-[#1e2730] bg-[#0c1014] px-2 py-1 text-[#6a7e8e] hover:border-[#3a2020] hover:text-[#cc5040]">Close`);
var canvasEl2;
var ctx2;
var painting = false;
var lastPaint = {
  x: -1,
  y: -1
};
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
function applyTool(c, r) {
  if (!inMapBounds(c, r)) return;
  const tool = editorTool();
  if (tool === "boss") {
    if (c + 1 >= mapGrid.size || r + 1 >= mapGrid.size) return;
    if (c - 1 < 0 || r - 1 < 0) return;
    for (let dr = -1; dr < 2; dr++) for (let dc = -1; dc < 2; dc++) if (hasCover(c + dc, r + dr)) return;
    unsetBoss();
    for (let dr = -1; dr < 2; dr++) {
      for (let dc = -1; dc < 2; dc++) {
        setCell(c + dc, r + dr, 32 /* BossCover */);
      }
    }
    setCell(c, r, 64 /* BossOrigin */);
  } else if (tool === "hcov") {
    setCell(c, r, 8 /* HalfCover */);
  } else if (tool === "fcov") {
    setCell(c, r, 16 /* FullCover */);
  } else if (tool === "spawn") {
    if (!hasCover(c, r)) setCell(c, r, 1 /* Spawn */, true);
  } else if (tool === "hbnd_h") {
    if (!inMapBounds(c, r + 1) || hasCover(c, r) || hasCover(c, r + 1)) return;
    setCell(c, r, 2 /* HBoundary */, true);
    setCell(c, r + 1, 2 /* HBoundary */, true);
  } else if (tool === "hbnd_v") {
    if (!inMapBounds(c + 1, r) || hasCover(c, r) || hasCover(c + 1, r)) return;
    setCell(c, r, 4 /* VBoundary */, true);
    setCell(c + 1, r, 4 /* VBoundary */, true);
  } else if (tool === "erase") {
    const cell = getCell(c, r);
    if (isTileType(cell, 32 /* BossCover */) || isTileType(cell, 64 /* BossOrigin */)) {
      unsetBoss();
    } else {
      setCell(c, r, 0 /* Empty */);
    }
  }
  editorRender();
}
var TOOL_BUTTONS = [{
  tool: "spawn",
  label: "Spawn",
  color: "#0d2060",
  border: "#3060cc"
}, {
  tool: "hbnd_h",
  label: "H-Boundary",
  color: "#2a2010",
  border: "#6a5020"
}, {
  tool: "hbnd_v",
  label: "V-Boundary",
  color: "#2a1a10",
  border: "#6a3a20"
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
function handlePointerDown2(e) {
  e.preventDefault();
  painting = true;
  const h = editorHit(e);
  applyTool(h.c, h.r);
  lastPaint.x = h.c;
  lastPaint.y = h.r;
}
function handlePointerMove2(e) {
  const pos = editorHit(e);
  if (pos.c < 0 || pos.r < 0) return;
  setEditorCoords(`${String(pos.r).padStart(2, "0")},${String(pos.c).padStart(2, "0")}`);
  if (!painting || lastPaint.x === pos.c && lastPaint.y === pos.r) return;
  applyTool(pos.c, pos.r);
  lastPaint.x = pos.c;
  lastPaint.y = pos.r;
}
function handlePointerUp2(e) {
  painting = false;
  lastPaint.x = -1;
  lastPaint.y = -1;
}
function EditorView() {
  onMount(() => {
    canvasEl2.width = CANVAS_SIZE * SCALE;
    canvasEl2.height = CANVAS_SIZE * SCALE;
    ctx2 = canvasEl2.getContext("2d");
    loadEditorMap();
    editorRender();
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
    var _el$ = _tmpl$39(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling, _el$7 = _el$6.nextSibling, _el$8 = _el$7.nextSibling, _el$9 = _el$8.nextSibling, _el$0 = _el$9.nextSibling, _el$1 = _el$0.nextSibling, _el$10 = _el$1.nextSibling, _el$11 = _el$10.nextSibling, _el$12 = _el$2.nextSibling, _el$13 = _el$12.firstChild, _el$14 = _el$12.nextSibling;
    insert(_el$3, createComponent(Select, {
      "class": "custom",
      get options() {
        return mapNames();
      },
      onChange: (value) => {
        loadMap(value);
        editorRender();
      },
      get initialValue() {
        return editingMap();
      }
    }), _el$4);
    insert(_el$5, editorCoords);
    insert(_el$3, () => TOOL_BUTTONS.map(({
      tool,
      label,
      color,
      border
    }) => (() => {
      var _el$15 = _tmpl$214(), _el$16 = _el$15.firstChild;
      _el$15.$$click = () => setEditorTool(tool);
      setStyleProperty(_el$16, "background", color);
      setStyleProperty(_el$16, "border", `1px solid ${border}`);
      insert(_el$15, label, null);
      createRenderEffect(() => className(_el$15, `flex cursor-pointer items-center gap-1 rounded border px-2 py-1 whitespace-nowrap transition-colors ${editorTool() === tool ? "border-[#2060cc] bg-[#1C2A32] text-[#4a9aff]" : "border-[#1e2730] bg-[#1C2A32] text-[#6a7e8e] hover:border-[#2e4050] hover:text-[#9ab0c0]"}`));
      return _el$15;
    })()), _el$8);
    _el$9.$$click = () => {
      editorResetLayout();
      editorRender();
    };
    _el$0.$$click = () => {
      editorClearAll();
      editorRender();
    };
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
    _el$13.addEventListener("pointerleave", handlePointerUp2);
    _el$13.$$pointerup = handlePointerUp2;
    _el$13.$$pointermove = handlePointerMove2;
    _el$13.$$pointerdown = handlePointerDown2;
    var _ref$ = canvasEl2;
    typeof _ref$ === "function" ? use(_ref$, _el$13) : canvasEl2 = _el$13;
    insert(_el$14, editorStatus);
    insert(_el$, (() => {
      var _c$ = memo(() => !!showEditorIo());
      return () => _c$() && (() => {
        var _el$17 = _tmpl$310(), _el$18 = _el$17.firstChild, _el$19 = _el$18.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.nextSibling;
        _el$18.$$input = (e) => setEditorIoText(e.currentTarget.value);
        setAttribute(_el$18, "spellcheck", false);
        _el$20.$$click = handleDoIO;
        insert(_el$20, () => editorIoMode() === "export" ? "Copy to clipboard" : "Load map");
        _el$21.$$click = () => setShowEditorIo(false);
        createRenderEffect(() => _el$18.value = editorIoText());
        return _el$17;
      })();
    })(), null);
    return _el$;
  })();
}
delegateEvents(["click", "pointerdown", "pointermove", "pointerup", "input"]);

// src/components/icons/Fortification.tsx
var _tmpl$40 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 40 40"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-5,-5)><g transform=matrix(1.5,0,0,1.5,-22.25,-20.75)><circle cx=31.5 cy=30.5 r=6 style=fill:rgb(77,131,152)></circle></g><g transform=matrix(2.03293,-2.03293,2.32335,2.32335,-82.455,23.2575)><path d="M30,20L30,27L22,27L22,20L30,20ZM28.828,21.025C27.267,19.659 24.733,19.659 23.172,21.025C21.611,22.391 21.611,24.609 23.172,25.975C24.733,27.341 27.267,27.341 28.828,25.975C30.389,24.609 30.389,22.391 28.828,21.025Z"style=fill:rgb(201,200,204);fill-opacity:0.5></path></g><g transform=matrix(2.03846,0,0,2.03846,-39.2115,-37.1731)><path d="M26.186,34.242C25.439,33.183 25,31.893 25,30.5C25,29.009 25.503,27.635 26.348,26.538L25.348,24.871C25.257,24.721 25.281,24.529 25.405,24.405C25.529,24.281 25.721,24.257 25.871,24.348L27.538,25.348C28.635,24.503 30.009,24 31.5,24C32.991,24 34.365,24.503 35.462,25.348L37.129,24.348C37.279,24.257 37.471,24.281 37.595,24.405C37.719,24.529 37.743,24.721 37.652,24.871L36.652,26.538C37.497,27.635 38,29.009 38,30.5C38,31.893 37.561,33.183 36.814,34.242L37.652,35.638C37.743,35.789 37.719,35.981 37.595,36.105C37.471,36.228 37.279,36.252 37.129,36.162L35.806,35.368C34.659,36.383 33.151,37 31.5,37C29.849,37 28.341,36.383 27.194,35.368L25.871,36.162C25.721,36.252 25.529,36.228 25.405,36.105C25.281,35.981 25.257,35.789 25.348,35.638L26.186,34.242ZM31.5,24.858C28.386,24.858 25.858,27.386 25.858,30.5C25.858,33.614 28.386,36.142 31.5,36.142C34.614,36.142 37.142,33.614 37.142,30.5C37.142,27.386 34.614,24.858 31.5,24.858Z"style=fill:rgb(201,200,204)>`);
function Fortification() {
  return _tmpl$40();
}

// src/components/icons/Borrow.tsx
var _tmpl$41 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 20 20"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-80.75,-27)><g transform=matrix(0.954545,0,0,1.22222,3.72727,-8.44444)><path d="M82,42.909L82,40.552C82,39.144 83.464,38 85.268,38L89.732,38C91.536,38 93,39.144 93,40.552L93,42.909L82,42.909Z"style=fill:rgb(249,196,32)></path></g><g transform=matrix(0.933333,0,0,0.875,5.86667,3.75)><ellipse cx=87.25 cy=34 rx=3.75 ry=4 style=fill:rgb(249,196,32)></ellipse></g></g><g transform=matrix(1,0,0,1,-80.75,-27)><g transform=matrix(0.818182,0,0,1.04762,23.4091,-2.95238)><path d="M83.125,38.626C83.699,38.236 84.448,38 85.268,38L89.732,38C91.536,38 93,39.144 93,40.552L93,42.909L86.583,42.909L86.583,41.591C86.583,40.041 85.063,38.766 83.125,38.626Z"style=fill:rgb(249,196,32)></path></g><g transform=matrix(0.8,0,0,0.75,25.2429,7.5)><ellipse cx=87.25 cy=34 rx=3.75 ry=4 style=fill:rgb(249,196,32)>`);
function Borrow() {
  return _tmpl$41();
}

// src/components/Buffs.tsx
var _tmpl$45 = /* @__PURE__ */ template(`<span>When this unit possesses a <span style=color:#8679e8>Corrosion</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$215 = /* @__PURE__ */ template(`<span>When this unit has a <span style=color:#e67129>Burn</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$311 = /* @__PURE__ */ template(`<span>If an enemy is afflicted by Corrosion debuff(s), increases critical damage against them by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$46 = /* @__PURE__ */ template(`<span>Damage dealt is increased by <span style=color:#f26c1c>20%</span> when distance to the enemy target is less than or equal to <span style=color:#f26c1c>6 tiles</span>.`);
var _tmpl$54 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>2000</span> points of <span style=color:#f26c1c>healing</span> or <span style=color:#f26c1c>shield</span> applied to allies by Support Dolls, gain <span style=color:#f26c1c>1 stack</span> of <span style=color:#3487e0>Complementarity Plan</span>.`);
var _tmpl$63 = /* @__PURE__ */ template(`<span>If this unit's has <span style=color:#f26c1c>2 or more</span> points of Confectance Index at the start of the round, damage dealt is increased by <span style=color:#f26c1c>25%</span> until the end of the round.`);
var _tmpl$73 = /* @__PURE__ */ template(`<span>Corrosion damage is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$83 = /* @__PURE__ */ template(`<span>Increases <span style=color:#d4ae08>Electric</span> and <span style=color:#8679e8>Corrosion</span> damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$93 = /* @__PURE__ */ template(`<span>When this unit has an <span style=color:#d4ae08>Electric</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$0 = /* @__PURE__ */ template(`<span>At the start of the turn, gain <span style=color:#f26c1c>10 stacks</span> of <span style=color:#3487e0>Firepower Overmatch</span>.\\nFirepower Overmatch:\\nDamage dealt is increased by <span style=color:#f26c1c>8%</span> and critical damage is increased by <span style=color:#f26c1c>5%</span> per stack, to a maximum of <span style=color:#f26c1c>50 stacks</span>. For <span style=color:#f26c1c>each point</span> of mobility spent, remove <span style=color:#f26c1c>1 stack</span> of this effect.`);
var _tmpl$1 = /* @__PURE__ */ template(`<span>When shielded, attacks ignore <span style=color:#f26c1c>20%</span> of the target's defense and critical damage is increased by <span style=color:#f26c1c>10%</span>.`);
var _tmpl$102 = /* @__PURE__ */ template(`<span>When this unit has a <span style=color:#42cce0>Freeze</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$112 = /* @__PURE__ */ template(`<span>Light Ammo ignores <span style=color:#f26c1c>50%</span> of target's defense.`);
var _tmpl$122 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>1 allied unit</span> within <span style=color:#f26c1c>5 tiles</span>, damage dealt is increased by <span style=color:#f26c1c>6%</span>.`);
var _tmpl$132 = /* @__PURE__ */ template(`<span>Sentinel-class Dolls' critical damage is increased by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$142 = /* @__PURE__ */ template(`<span>Increases Corrosion and Freeze damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$152 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>5 tiles</span> moved, damage dealt is permanently increased by <span style=color:#f26c1c>5%</span>. Maximum of <span style=color:#f26c1c>10 stacks</span>.`);
var _tmpl$162 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>1 instance</span> of fixed damage taken by an enemy, all damage dealt by allied units is permanently increased by <span style=color:#f26c1c>2%</span>. Maximum of 15 stacks.`);
var _tmpl$172 = /* @__PURE__ */ template(`<span><span style=color:#f26c1c>Each time</span> a Bulwark-class Doll takes damage, gain <span style=color:#f26c1c>1 stack</span> of <span style=color:#3487e0>Undaunted Spirit</span>.`);
var tsxBuffs = {
  b1: _tmpl$45(),
  b4: _tmpl$215(),
  b6: _tmpl$311(),
  b12: _tmpl$46(),
  b13: _tmpl$54(),
  b14: _tmpl$63(),
  b16: _tmpl$73(),
  b18: _tmpl$83(),
  b23: _tmpl$93(),
  b27: _tmpl$0(),
  b28: _tmpl$1(),
  b29: _tmpl$102(),
  b45: _tmpl$112(),
  b49: _tmpl$122(),
  b51: _tmpl$132(),
  b55: _tmpl$142(),
  b61: _tmpl$152(),
  b65: _tmpl$162(),
  b67: _tmpl$172()
};
function Buffs(props) {
  if (props.id in tsxBuffs) {
    return tsxBuffs[props.id];
  }
  return null;
}

// src/components/SummaryView.tsx
var _tmpl$47 = /* @__PURE__ */ template(`<div class="flex flex-row gap-2"><div style="width:430px;height:430px;flex-shrink:0;overflow:hidden;border-right:1px solid #3f3f46"></div><div class="flex min-w-0 grow flex-col gap-1 overflow-y-auto">`);
var _tmpl$216 = /* @__PURE__ */ template(`<div class="flex flex-col items-start gap-1 rounded-xs border-b-2 bg-[#F4F4F6] p-1 shadow-sm shadow-black/30"><div class="flex flex-row items-center gap-1"><div class="font-bold text-[#325563]"></div></div><div class="min-w-0 flex-1"><div class="flex flex-wrap gap-1">`);
var _tmpl$312 = /* @__PURE__ */ template(`<span class="rounded-sm bg-[#384B53] px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50">`);
var _tmpl$48 = /* @__PURE__ */ template(`<div class="pt-1 text-sm text-zinc-600">No actions recorded`);
var _tmpl$55 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2">`);
var _tmpl$64 = /* @__PURE__ */ template(`<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3"><div class="grid grid-cols-2 gap-2"></div><div class="flex flex-row flex-wrap gap-2 min-[1860px]:grid min-[1860px]:grid-cols-3">`);
var _tmpl$74 = /* @__PURE__ */ template(`<div class="relative h-6 w-6">`);
var _tmpl$84 = /* @__PURE__ */ template(`<div class="absolute bottom-1 left-2 z-10 h-8 w-8"><img class="relative h-full w-full object-cover">`);
var _tmpl$94 = /* @__PURE__ */ template(`<div class="flex flex-row items-center gap-2 rounded-sm border-t-4 border-[#3E5356] bg-[#2C373B] p-2 shadow-sm shadow-black/50"><div class="text-md flex w-12 flex-col items-center justify-center"><div class="relative h-12 w-12"><div class="absolute z-10"></div><div class="absolute z-20 flex h-full w-full items-center justify-center pt-0.5 text-[18px] font-bold"></div></div></div><div class="text-md relative flex h-12 w-12 flex-col items-center justify-start overflow-hidden rounded-full"><div class="h-8 w-8"><img></div><div class="absolute bottom-0 flex h-full w-full items-end justify-center bg-linear-to-t from-black/50 via-black/20 to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class></div></div></div><div class="relative flex h-17 w-32.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50"><div></div><img><div>`);
var _tmpl$02 = /* @__PURE__ */ template(`<div class="absolute right-1.5 bottom-1.5 z-20 rounded-sm bg-[#2A3D46] px-1 text-sm font-bold text-[#EFEFEF]">`);
var _tmpl$110 = /* @__PURE__ */ template(`<div class="inset-shadow-2xl relative flex h-17 w-17 flex-col items-center justify-center"><div class="absolute z-10"><div class="relative w-20"><img class="w-full object-cover object-top">`);
var _tmpl$103 = /* @__PURE__ */ template(`<div class="absolute right-0 bottom-0.5 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]"><div class="relative -top-1 -left-2.25 w-12"><img class="w-full object-cover object-top">`);
var _tmpl$113 = /* @__PURE__ */ template(`<div class="relative flex grow flex-row items-start gap-3 rounded-sm bg-[#F2EEF8] p-2.5 shadow-sm shadow-black/20"><div><img class="relative z-20 h-full w-full object-cover"></div><div class="flex grow flex-col gap-3 text-[#384B53]"><div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]"><div class="text-left font-bold text-black"></div><div class=text-left></div></div><div class=text-left>`);
function renderTabCanvas(tabIndex) {
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
  for (let x = 0; x < mapGrid.size; x++) {
    for (let y = 0; y < mapGrid.size; y++) {
      const cell = isTileType(mapGrid.tiles[gridKey(x, y)], 64 /* BossOrigin */);
      if (cell) {
        if (x < bMinC) bMinC = x;
        if (x > bMaxC) bMaxC = x;
        if (y < bMinR) bMinR = y;
        if (y > bMaxR) bMaxR = y;
      }
    }
  }
  if (!isFinite(bMinC)) {
    bMinC = 0;
    bMaxC = mapGrid.size - 1;
    bMinR = 0;
    bMaxR = mapGrid.size - 1;
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
      var _el$ = _tmpl$47(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
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
              var _el$4 = _tmpl$216(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild;
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
                  var _el$9 = _tmpl$312();
                  insert(_el$9, () => renderAction(dollId, a));
                  return _el$9;
                })()
              }));
              return _el$4;
            })();
          }
        }) : _tmpl$48();
      })());
      return _el$;
    }
  });
}
function SummaryView() {
  return (() => {
    var _el$1 = _tmpl$64(), _el$10 = _el$1.firstChild, _el$11 = _el$10.nextSibling;
    insert(_el$10, createComponent(For, {
      get each() {
        return state.selectedDolls;
      },
      children: (doll) => {
        const dollInfo = getDollFromId(doll.id);
        if (!dollInfo) return null;
        const dollFortification2 = createMemo(() => doll.fortification || "\u2014");
        const dollRemolding = createMemo(() => "Lv." + doll.remoldingLvl);
        const dollWeapon = createMemo(() => {
          let gun = allWeapons.find((w) => w.id === doll.gun);
          if (!gun) gun = allWeapons.find((w) => w.imprintId === doll.id);
          if (!gun) gun = defaultWeapons[dollInfo.gunType];
          return gun;
        });
        const dollKeys = createMemo(() => sortEquippedKeys(doll.id, doll.keys));
        return (() => {
          var _el$13 = _tmpl$94(), _el$14 = _el$13.firstChild, _el$16 = _el$14.firstChild, _el$17 = _el$16.firstChild, _el$18 = _el$17.nextSibling, _el$19 = _el$14.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$20.firstChild, _el$22 = _el$20.nextSibling, _el$23 = _el$22.firstChild, _el$24 = _el$19.nextSibling, _el$27 = _el$24.firstChild, _el$28 = _el$27.nextSibling, _el$29 = _el$28.nextSibling;
          insert(_el$13, createComponent(SmallDollChip, {
            target: dollInfo,
            get doll() {
              return getDollFromSummon(dollInfo);
            }
          }), _el$14);
          insert(_el$14, createComponent(Show, {
            get when() {
              return doll.borrow;
            },
            get children() {
              var _el$15 = _tmpl$74();
              insert(_el$15, createComponent(Borrow, {}));
              return _el$15;
            }
          }), _el$16);
          insert(_el$17, createComponent(Fortification, {}));
          insert(_el$18, dollFortification2);
          insert(_el$23, dollRemolding);
          insert(_el$24, createComponent(Show, {
            get when() {
              return dollWeapon().imprintImage;
            },
            get children() {
              var _el$25 = _tmpl$84(), _el$26 = _el$25.firstChild;
              createRenderEffect(() => setAttribute(_el$26, "src", dollWeapon().imprintImage));
              return _el$25;
            }
          }), _el$27);
          insert(_el$27, () => dollWeapon().name);
          insert(_el$13, createComponent(For, {
            get each() {
              return dollKeys();
            },
            children: (key) => key && (() => {
              var _el$30 = _tmpl$110(), _el$31 = _el$30.firstChild, _el$32 = _el$31.firstChild, _el$33 = _el$32.firstChild;
              insert(_el$30, createComponent(Show, {
                get when() {
                  return key.number !== null;
                },
                get children() {
                  var _el$34 = _tmpl$02();
                  insert(_el$34, () => key.number);
                  return _el$34;
                }
              }), null);
              insert(_el$30, (() => {
                var _c$2 = memo(() => "dollAvatar" in key);
                return () => _c$2() && (() => {
                  var _el$35 = _tmpl$103(), _el$36 = _el$35.firstChild, _el$37 = _el$36.firstChild;
                  createRenderEffect(() => setAttribute(_el$37, "src", key.dollAvatar));
                  return _el$35;
                })();
              })(), null);
              createRenderEffect(() => setAttribute(_el$33, "src", key.localImagePath));
              return _el$30;
            })()
          }), null);
          createRenderEffect((_p$) => {
            var _v$ = dollInfo.remolding, _v$2 = `absolute bottom-1 z-30 w-full text-right font-bold ${dollWeapon().imprintId === null ? "pl-1.25" : "pl-9"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`, _v$3 = dollWeapon().localImagePath, _v$4 = `relative z-20 h-full w-full border-b-3 ${dollWeapon().rarity === "Elite" ? "border-[#DF9E00]" : "border-[#3291AB]"} object-cover`, _v$5 = `absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${dollWeapon().rarity === "Elite" ? "from-[#453824]" : "from-[#133843]"} from-0% to-transparent to-75%`;
            _v$ !== _p$.e && setAttribute(_el$21, "src", _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$27, _p$.t = _v$2);
            _v$3 !== _p$.a && setAttribute(_el$28, "src", _p$.a = _v$3);
            _v$4 !== _p$.o && className(_el$28, _p$.o = _v$4);
            _v$5 !== _p$.i && className(_el$29, _p$.i = _v$5);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0
          });
          return _el$13;
        })();
      }
    }));
    insert(_el$11, createComponent(Modal, {
      width: "min-w-151 grow",
      get children() {
        var _el$12 = _tmpl$55();
        insert(_el$12, createComponent(For, {
          get each() {
            return state.buffs;
          },
          children: (buffId) => {
            const buff = allBuffs.find((b) => buffId === b.id);
            if (!buff) return null;
            const days = () => {
              if (buff.core && buff.season === CURRENT_SEASON) {
                return "Effective this season";
              }
              if (buff.days && buff.days[CURRENT_SEASON]) {
                return "Available on days " + buff.days[CURRENT_SEASON].map((day) => day + 1).join(", ");
              }
              return "Unavailable this gunsmoke season";
            };
            return (() => {
              var _el$38 = _tmpl$113(), _el$39 = _el$38.firstChild, _el$40 = _el$39.firstChild, _el$41 = _el$39.nextSibling, _el$42 = _el$41.firstChild, _el$43 = _el$42.firstChild, _el$44 = _el$43.nextSibling, _el$45 = _el$42.nextSibling;
              insert(_el$43, () => buff.name);
              insert(_el$44, days);
              insert(_el$45, createComponent(Buffs, {
                get id() {
                  return buff.id;
                }
              }));
              createRenderEffect((_p$) => {
                var _v$6 = `relative flex h-15 w-15 shrink-0 ${buff.core ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`, _v$7 = buff.localImagePath;
                _v$6 !== _p$.e && className(_el$39, _p$.e = _v$6);
                _v$7 !== _p$.t && setAttribute(_el$40, "src", _p$.t = _v$7);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$38;
            })();
          }
        }));
        return _el$12;
      }
    }), null);
    insert(_el$11, createComponent(For, {
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

// src/components/icons/All.tsx
var _tmpl$49 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=All><g transform=matrix(1.70115,-3.86259e-32,0,1.70115,-40.1313,-31.7244)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.70115,-3.86259e-32,0,1.70115,-40.1313,-72.7244)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.04166e-16,-1.70115,1.70115,1.04166e-16,-31.7244,120.131)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.04166e-16,-1.70115,1.70115,1.04166e-16,-72.7244,120.131)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z>`);
function All(props) {
  return (() => {
    var _el$ = _tmpl$49(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$3.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild;
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
var _tmpl$50 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.58211,0,0,1.96189,-23.2842,-43.7583)><g id=Burn><path id=standalone1 serif:id=standalone d="M33.696,61.874C31.412,61.39 29.373,60.638 27.611,59.665C22.976,56.825 20,52.43 20,47.5C20,47.378 20.002,47.257 20.005,47.136L20,47.136C20.022,42.298 22.463,38.039 26.151,35.553L26.151,36.321L26.166,36.31L26.166,37.225C25.873,37.711 25.714,38.242 25.714,38.757C25.714,40.416 27.471,41.785 29.902,41.762C33.055,41.733 34.559,39.775 34.559,38.116C34.559,37.807 34.477,37.514 34.329,37.243L34.329,37.22C33.787,36.034 33.512,34.557 33.601,32.742C33.61,32.568 33.628,32.393 33.655,32.218L33.642,32.218C33.659,32.141 33.676,32.065 33.695,31.989C34.345,28.673 38.109,25.149 42.496,23.457C42.63,23.406 42.763,23.361 42.896,23.324C42.899,24.148 42.948,25.064 42.948,26.042C42.948,27.27 44.643,31.18 49.318,33.784C55.668,36.382 60,41.552 60,47.5C60,52.559 56.866,57.055 52.023,59.884C50.109,60.883 47.884,61.627 45.381,62.062C49.032,60.428 51.791,57.425 51.791,54.64C51.791,52.663 51.135,51.019 50.053,49.758L50.084,49.702L49.898,49.584C49.242,48.868 48.444,48.283 47.549,47.841C44.734,45.506 41.84,42.273 41.84,40.492C41.84,40.298 41.852,40.109 41.875,39.925C40.472,41.233 39.564,43.317 39.564,45.663C39.564,46.699 39.741,47.684 40.06,48.574C40.067,48.687 40.07,48.801 40.07,48.916C40.07,51.609 38.273,53.796 36.06,53.796C34.221,53.796 32.669,52.285 32.198,50.228C30.435,51.815 29.351,53.856 29.351,55.835C29.351,58.332 31.066,60.524 33.696,61.874Z">`);
function Burn(props) {
  return (() => {
    var _el$ = _tmpl$50(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(228,102,41)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Corrosion.tsx
var _tmpl$51 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.74713,0,0,1.74713,-30.3218,-30.7586)><g id=Corrosion><g id=standalone1 serif:id=standalone><g transform=matrix(1.11111,0,0,1.25,-5.38889,-15.5)><ellipse cx=39.5 cy=58 rx=4.5 ry=4></ellipse></g><g transform=matrix(1.06667,0,0,1.23077,-4.13333,-11.2308)><ellipse cx=54.5 cy=46.5 rx=7.5 ry=6.5></ellipse></g><g transform=matrix(1.18182,0,0,1,-10.5455,1)><ellipse cx=52.5 cy=24.5 rx=5.5 ry=6.5></ellipse></g><g transform=matrix(0.884615,0,0,1.21053,4.34615,-7.68421)><ellipse cx=29 cy=36.5 rx=13 ry=9.5>`);
function Corrosion(props) {
  return (() => {
    var _el$ = _tmpl$51(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild;
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
var _tmpl$56 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.63441,0,0,1.63441,-27.828,-26.6022)><g id=Electric><path id=standalone1 serif:id=standalone d=M50,17.5L33,17.5L25,46L42,42L34,64L58,33L40,36L50,17.5Z>`);
function Electric(props) {
  return (() => {
    var _el$ = _tmpl$56(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(235,191,33)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Freeze.tsx
var _tmpl$57 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.58333,0,0,1.58333,-23.1721,-23.3333)><g id=Freeze><g id=standalone1 serif:id=standalone><g transform=matrix(1,0,0,1.2,-2,-12.8)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(1,0,0,1.2,-2,-36.8)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(0.961538,0,0,1.13636,-0.865385,-6.02273)><ellipse cx=42.5 cy=40.5 rx=6.5 ry=5.5></ellipse></g><g transform=matrix(0.499153,0.866514,-1.03982,0.598984,85.5838,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(-0.499989,0.866032,-1.03924,-0.599987,127.511,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(-0.499153,0.866514,1.03982,0.598984,-5.78748,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(0.499989,0.866032,1.03924,-0.599987,-47.7144,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z>`);
function Freeze(props) {
  return (() => {
    var _el$ = _tmpl$57(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$1.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$11.nextSibling, _el$14 = _el$13.firstChild, _el$15 = _el$13.nextSibling, _el$16 = _el$15.firstChild;
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
var _tmpl$58 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.72817,0,0,1.72817,-29.223,-29.1504)><g id=Hydro><g id=standalone1 serif:id=standalone><g transform=matrix(1,0,0,1,2,-1.5)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"></path></g><g transform=matrix(-1,0,0,-1,78.1114,81.5649)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z">`);
function Hydro(props) {
  return (() => {
    var _el$ = _tmpl$58(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild;
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
var _tmpl$59 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.54461,0,0,1.54461,-22.3824,-21.7702)><g id=Omni><g id=standalone1 serif:id=standalone><g transform=matrix(1.27442,0,0,1.099,-10.2998,-2.98897)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(-0.585385,1.02359,-0.954008,-0.545589,103.249,20.7405)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(0.517371,0.996336,0.97534,-0.506469,-9.83172,37.6917)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(1.13281,-1.73412e-17,1.49543e-17,-1.099,14.7335,84.989)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(-0.547687,0.991618,0.962018,0.531338,13.4075,-3.22855)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(0.55516,1.00515,-0.962018,0.531338,56.4324,-22.5184)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z>`);
function Omni(props) {
  return (() => {
    var _el$ = _tmpl$59(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$1.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$11.nextSibling, _el$14 = _el$13.firstChild;
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
var _tmpl$60 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(2.47396,0,0,2.05405,-56.4844,-37.027)><g id=Physical><path id=standalone1 serif:id=standalone d=M39,19L52.856,28.25L52.856,46.75L39,56L25.144,46.75L25.144,28.25L39,19ZM29.023,44.16L32.903,41.57L32.903,33.43L39,29.36L45.097,33.43L45.097,41.57L48.977,44.16L48.977,30.84L39,24.18L29.023,30.84L29.023,44.16Z>`);
function Physical(props) {
  return (() => {
    var _el$ = _tmpl$60(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
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
var _tmpl$61 = /* @__PURE__ */ template(`<div><div><div class="absolute top-1 left-1 h-6 w-6"></div><img loading=lazy class="h-auto w-32 object-cover"></div><div class="bg-[#1C2A32] p-1 text-center font-bold text-[#EFEFEF]">`, true, false, false);
var _tmpl$217 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function DollChip(props) {
  return (() => {
    var _el$ = _tmpl$61(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$2.nextSibling;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$6 = _tmpl$217();
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
      var _v$ = props.style, _v$2 = `doll ${props.doll.phase} All show h-40.5 w-31.5 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 ${interactiveStyles(props.selected)}`, _v$3 = `relative flex justify-center border-b-4 bg-[#C9C8CD] ${props.doll.rarity === "Elite" ? "border-b-[#DF9E00]" : "border-b-[#7968BA]"}`, _v$4 = props.target.avatar;
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
var _tmpl$65 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75">`);
var _tmpl$218 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="grid grid-cols-6 gap-4">`);
var _tmpl$313 = /* @__PURE__ */ template(`<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Changing dolls will clear their positions and actions`);
var _tmpl$410 = /* @__PURE__ */ template(`<button><div class="h-6 w-6"></div><span>`);
function DollSelectorModal() {
  const selectedDollIds = createMemo(() => tempSelectedDolls.map((doll) => doll.id));
  const toggleDoll = (id) => {
    if (selectedDollIds().includes(id)) {
      removeDollFromTempSelect(id);
    } else if (selectedDollIds().length < 5) {
      addDollToTempSelect(id);
    }
  };
  const toggleDollVisibility = async (phase) => {
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
    var _el$ = _tmpl$65();
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
    var _el$2 = _tmpl$218(), _el$3 = _el$2.firstChild;
    insert(_el$3, createComponent(For, {
      each: allDolls,
      children: (doll) => {
        const isSel = () => selectedDollIds().includes(doll.id);
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
  })(), _tmpl$313(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setShowDollModal(false),
        color: "dark",
        design: "cancel"
      }), createComponent(Button, {
        onClick: () => {
          setShowDollModal(false);
          setShowFormationModal(true);
        },
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["click"]);

// src/components/modals/ImportModal.tsx
var _tmpl$66 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><textarea class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-4 font-mono text-xs"placeholder="Paste here..."></textarea><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Imported state will overwrite all current settings`);
function ImportModal() {
  const [text, setText] = createSignal("");
  const performImport = async () => {
    setLoaded(false);
    setStateFromURL(false);
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    await importState(loadFromString, text(), true);
    setShowImportModal(false);
    setLoaded(true);
  };
  return [createComponent(ModalHeader, {
    title: "Import Transcript"
  }), (() => {
    var _el$ = _tmpl$66(), _el$2 = _el$.firstChild;
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
var _tmpl$67 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"><div class="overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]"><div class="border-b border-zinc-700 p-6 text-center"><h3 class="text-lg font-bold">Select Target Character</h3><p class="text-xs text-zinc-400"> \u2192 Target</p></div><div class="grid grid-cols-3 justify-items-center gap-4 p-5"></div><div class="flex justify-center gap-4 border-t border-zinc-700 p-6">`);
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
    var _el$ = _tmpl$67(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$3.nextSibling, _el$8 = _el$7.nextSibling;
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

// src/components/modals/ExportModal.tsx
var _tmpl$68 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75"><button><span>Export</span></button><button><span>Share`);
var _tmpl$219 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Export as Text</div><div class="mx-3 flex flex-row items-center justify-center gap-1 text-[#384B53]"><span>Export style:</span></div><textarea class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs"placeholder=Loading...>`);
var _tmpl$314 = /* @__PURE__ */ template(`<div class="text-md mx-3 text-center flex p-2 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">`);
var _tmpl$411 = /* @__PURE__ */ template(`<div class="text-md text-center mx-3 flex p-2 items-center justify-center self-stretch bg-[#AE4749] font-bold tracking-wide text-[#ECECEC]">`);
var _tmpl$510 = /* @__PURE__ */ template(`<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Share Link`);
var _tmpl$69 = /* @__PURE__ */ template(`<textarea class="mx-3 h-16 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs"placeholder=Loading...>`);
var _tmpl$75 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><label class="mx-3 flex flex-row items-center justify-center gap-1 text-[#384B53]">Score: <input class=input type=number></label><textarea maxlength=128 class="input mx-3 h-16 resize-none items-center justify-center self-stretch overflow-hidden rounded-md p-2 text-xs"placeholder="Optional Description...">`);
function ExportModal() {
  const exportOptions = ["code only", "code for discord", "shareable url"];
  const [activeTab2, setActiveTab2] = createSignal("export");
  const [errorText, setErrorText] = createSignal("");
  const [readiness, setReadiness] = createSignal("");
  const [shareLink, setShareLink] = createSignal("");
  const isExportTab = () => activeTab2() === "export";
  const isShareTab = () => activeTab2() === "share";
  const [exportType, setExportType] = createSignal(exportOptions[2]);
  const [copied, setCopied] = createSignal(false);
  const getExportString = async () => {
    const exportObj = {
      version: SAVE_VERSION,
      ...state
    };
    return await compress(exportObj);
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
  const beforeShare = () => {
    let value = [];
    let missingKeys = [];
    if (state.score === 0) {
      value.push("Include a predicted final score for this investment.");
    }
    for (const doll of state.selectedDolls) {
      const keys = sortEquippedKeys(doll.id, doll.keys);
      const fixedKeys = keys.filter((key) => key !== null && key.type === "Fixed Key");
      if (fixedKeys.length < 3) {
        const dollInfo = getDollFromId(doll.id);
        if (!dollInfo) continue;
        missingKeys.push(`${dollInfo.name} is missing fixed keys`);
      }
    }
    if (missingKeys.length > 2) {
      value.push("Multiple dolls are missing fixed keys.");
    } else {
      value.push(...missingKeys);
    }
    setReadiness(value.join("\n"));
  };
  const shareTranscript = async () => {
    setErrorText("");
    setShareLink("");
    if (readiness() !== "") return false;
    const exportObj = {
      version: SAVE_VERSION,
      ...state
    };
    try {
      const encoded = await compress(exportObj);
      const res = await fetch("https://gunsmoke.arkahnx.technology/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          map: exportObj.map,
          dolls: exportObj.selectedDolls.map((d) => ({
            id: d.id,
            fortification: d.fortification
          })),
          score: exportObj.score,
          description: exportObj.description,
          state: encoded
        })
      });
      const data = await res.json();
      if (data.error) {
        setErrorText(data.error);
        return;
      }
      if (data.result) {
        setShareLink(`${window.location.origin + window.location.pathname}?stateId=${data.result.stateId}`);
        saveToLocalStorage();
      }
    } catch (e) {
      setErrorText(e.message);
      return;
    }
  };
  const updateScore = (e) => {
    setState(produce((s) => {
      if (e.currentTarget instanceof HTMLInputElement) {
        s.score = parseInt(e.currentTarget?.value);
      }
    }));
    beforeShare();
  };
  const updateDescription = (e) => {
    setState(produce((s) => {
      if (e.currentTarget instanceof HTMLTextAreaElement) {
        s.description = e.currentTarget.value;
      }
    }));
  };
  beforeShare();
  return [createComponent(ModalHeader, {
    title: "Export Transcript"
  }), (() => {
    var _el$ = _tmpl$68(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    _el$2.$$click = () => {
      setActiveTab2("export");
    };
    _el$3.$$click = () => {
      setActiveTab2("share");
    };
    createRenderEffect((_p$) => {
      var _v$ = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isExportTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isShareTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`;
      _v$ !== _p$.e && className(_el$2, _p$.e = _v$);
      _v$2 !== _p$.t && className(_el$3, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })(), createComponent(Show, {
    get when() {
      return isExportTab();
    },
    get children() {
      return [(() => {
        var _el$4 = _tmpl$219(), _el$5 = _el$4.firstChild, _el$6 = _el$5.nextSibling, _el$7 = _el$6.firstChild, _el$8 = _el$6.nextSibling;
        insert(_el$6, createComponent(Select, {
          "class": "custom",
          options: exportOptions,
          onChange: setExportType,
          get initialValue() {
            return exportType();
          }
        }), null);
        createRenderEffect(() => _el$8.value = output());
        return _el$4;
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
  }), createComponent(Show, {
    get when() {
      return isShareTab();
    },
    get children() {
      return [(() => {
        var _el$9 = _tmpl$75(), _el$1 = _el$9.firstChild, _el$10 = _el$1.firstChild, _el$11 = _el$10.nextSibling, _el$12 = _el$1.nextSibling;
        insert(_el$9, createComponent(Show, {
          get when() {
            return readiness() !== "";
          },
          get children() {
            var _el$0 = _tmpl$314();
            insert(_el$0, readiness);
            return _el$0;
          }
        }), _el$1);
        _el$11.$$input = updateScore;
        _el$12.$$input = updateDescription;
        insert(_el$9, createComponent(Show, {
          get when() {
            return errorText() !== "";
          },
          get children() {
            var _el$13 = _tmpl$411();
            insert(_el$13, errorText);
            return _el$13;
          }
        }), null);
        insert(_el$9, createComponent(Show, {
          get when() {
            return shareLink() !== "";
          },
          get children() {
            return [_tmpl$510(), (() => {
              var _el$15 = _tmpl$69();
              createRenderEffect(() => _el$15.value = shareLink());
              return _el$15;
            })()];
          }
        }), null);
        createRenderEffect(() => _el$11.value = state.score);
        createRenderEffect(() => _el$12.value = state.description);
        return _el$9;
      })(), createComponent(ModalFooter, {
        styles: "justify-between",
        get children() {
          return [createComponent(Button, {
            onClick: () => setShowExportModal(false),
            color: "dark",
            design: "cancel",
            content: "Close"
          }), createComponent(Button, {
            onClick: shareTranscript,
            get disabled() {
              return readiness() !== "";
            },
            color: "dark",
            design: "confirm",
            content: "Share Transcript"
          })];
        }
      })];
    }
  })];
}
delegateEvents(["click", "input"]);

// src/components/modals/SkillDisplayModal.tsx
var _tmpl$70 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2 self-center"><div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]"><span>Override imported notations:</span></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Preview</div><div class="flex flex-wrap justify-center gap-1.5">`);
var _tmpl$220 = /* @__PURE__ */ template(`<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]"><span>`);
var _tmpl$315 = /* @__PURE__ */ template(`<div class="flex flex-col gap-1"><div class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-center text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50">`);
function SkillDisplayModal() {
  const dollInfo = getDollFromId("d54");
  const basicSkill = dollInfo?.skills?.filter((s) => s.type === "Basic Attack") ?? [];
  const passiveSkill = dollInfo?.skills?.filter((s) => s.type === "Passive") ?? [];
  const numberedSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [0-9]/)) ?? [];
  const letteredSkills = dollInfo?.skills?.filter((s) => s.type.match(/Skill [A-Z]/)) ?? [];
  const endTurnSkills = dollInfo?.skills?.filter((s) => s.type.match("End Turn")) ?? [];
  const moveSkills = dollInfo?.skills?.filter((s) => s.type.match("Move")) ?? [];
  const skills = [...moveSkills, ...basicSkill, ...numberedSkills, ...passiveSkill, ...letteredSkills, ...endTurnSkills];
  return [createComponent(ModalHeader, {
    title: "Skill Display"
  }), (() => {
    var _el$ = _tmpl$70(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.nextSibling;
    insert(_el$2, createComponent(Select, {
      "class": "custom",
      options: ["true", "false"],
      onChange: (value) => {
        setOverrideSkillNotations(value === "true" ? true : false);
        saveSkillDisplay();
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
        var _el$6 = _tmpl$220(), _el$7 = _el$6.firstChild;
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
        var _el$8 = _tmpl$315(), _el$9 = _el$8.firstChild;
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

// src/components/icons/CommonKey.tsx
var _tmpl$71 = /* @__PURE__ */ template(`<svg><g transform=matrix(1,0,0,0.944444,-0.5,-0.555556)><path d=M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8Z style=fill:rgb(63,78,82)></svg>`, false, true, false);
var _tmpl$221 = /* @__PURE__ */ template(`<svg><g transform=matrix(0.470588,0,0,0.444444,22.5294,7.94444)><path d=M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8Z style=fill:rgb(152,154,159)></svg>`, false, true, false);
var _tmpl$316 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 20 20"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-33,-5.5)><g transform=matrix(1.17647,0,0,1.11111,-8.17647,-3.38889)><path d=M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8ZM43.5,10.25L37.979,13.625L37.979,20.375L43.5,23.75L49.021,20.375L49.021,13.625L43.5,10.25Z>`);
function CommonKey(props) {
  const color = props.rarity === "Elite" ? "A87D36" : props.rarity === "Standard" ? "5F5A90" : "5B6468";
  return (() => {
    var _el$ = _tmpl$316(), _el$2 = _el$.firstChild, _el$5 = _el$2.firstChild, _el$6 = _el$5.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => props.rarity !== "Elite")() && props.rarity !== "Standard";
      },
      get children() {
        return _tmpl$71();
      }
    }), _el$5);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.rarity === "Elite" || props.rarity === "Standard";
      },
      get children() {
        return _tmpl$221();
      }
    }), _el$5);
    createRenderEffect((_$p) => style(_el$6, `fill:#${color}`, _$p));
    return _el$;
  })();
}

// src/components/icons/FixedKey.tsx
var _tmpl$76 = /* @__PURE__ */ template(`<svg><g transform=matrix(1,0,0,0.894737,-0.5,1.63158)><path d=M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6Z style=fill:rgb(63,78,82)></svg>`, false, true, false);
var _tmpl$223 = /* @__PURE__ */ template(`<svg><g transform=matrix(0.470588,0,0,0.421053,7.17647,8.97368)><path d=M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6Z style=fill:rgb(152,154,159)></svg>`, false, true, false);
var _tmpl$317 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 20 20"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-4,-5.5)><g transform=matrix(1.17647,0,0,1.05263,-3.05882,-0.815789)><path d=M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6ZM14.5,8.375L8.125,15.5L14.5,22.625L20.875,15.5L14.5,8.375Z>`);
function FixedKey2(props) {
  const color = props.rarity === "Elite" ? "A87D36" : props.rarity === "Standard" ? "5F5A90" : "5B6468";
  return (() => {
    var _el$ = _tmpl$317(), _el$2 = _el$.firstChild, _el$5 = _el$2.firstChild, _el$6 = _el$5.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => props.rarity !== "Elite")() && props.rarity !== "Standard";
      },
      get children() {
        return _tmpl$76();
      }
    }), _el$5);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.rarity === "Elite" || props.rarity === "Standard";
      },
      get children() {
        return _tmpl$223();
      }
    }), _el$5);
    createRenderEffect((_$p) => style(_el$6, `fill:#${color}`, _$p));
    return _el$;
  })();
}

// src/components/icons/SmallKey.tsx
function SmallKey(props) {
  if (!props.keyType) return null;
  if (props.keyType === "Affinity Key" || props.keyType === "Common Key") {
    return createComponent(CommonKey, {
      get rarity() {
        return props.rarity;
      }
    });
  }
  return createComponent(FixedKey2, {
    get rarity() {
      return props.rarity;
    }
  });
}

// src/components/DynamicDollChip.tsx
var _tmpl$77 = /* @__PURE__ */ template(`<div class="h-30 w-23 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50"><div><div class="absolute top-1 left-1 h-5 w-5"></div><img loading=lazy class="h-auto w-22.5 object-cover"></div><div class="bg-[#1C2A32] p-1 text-center text-[14px] font-bold text-[#EFEFEF]">`, true, false, false);
var _tmpl$224 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-6 w-6 shadow-sm shadow-black/20">`);
function DynamicDollChip(props) {
  return (() => {
    var _el$ = _tmpl$77(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$2.nextSibling;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$6 = _tmpl$224();
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
      var _v$ = props.style, _v$2 = `relative flex justify-center border-b-4 bg-[#C9C8CD] ${props.doll.rarity === "Elite" ? "border-b-[#DF9E00]" : "border-b-[#7968BA]"}`, _v$3 = props.target.avatar;
      _p$.e = style(_el$, _v$, _p$.e);
      _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
      _v$3 !== _p$.a && setAttribute(_el$4, "src", _p$.a = _v$3);
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

// src/components/modals/FormationModal.tsx
var _tmpl$78 = /* @__PURE__ */ template(`<div class="relative flex flex-wrap items-center justify-start gap-4 px-10 py-8"><div>`);
var _tmpl$225 = /* @__PURE__ */ template(`<div class="absolute bottom-1 left-2 z-10 h-8 w-8"><img class="relative h-full w-full object-cover">`);
var _tmpl$318 = /* @__PURE__ */ template(`<div class="flex items-center gap-3 bg-[#B6BAC6] p-2.5"><div class="flex flex-col gap-3"><div class="flex flex-row gap-3"><div></div><div><div></div><div class=w-6></div></div></div><div class="flex flex-row gap-3"><div class="text-md flex w-12 flex-col items-center justify-center rounded-sm bg-[#354346] shadow-sm shadow-black/50"><div class="relative h-12 w-12"><div class="absolute z-10"></div><div class="absolute z-20 flex h-full w-full items-center justify-center pt-0.5 text-[18px] font-bold"></div></div><div class="flex flex-row gap-2 text-sm font-bold"><button>-</button><button>+</button></div></div><div class="text-md flex w-14 flex-col items-center justify-center rounded-sm bg-[#354346] px-1 pt-1 shadow-sm shadow-black/50"><div class="relative h-12 w-12 overflow-hidden rounded-full"><img><div class="absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/50 via-black/20 to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class="overflow-hidden overflow-ellipsis whitespace-nowrap"></div></div></div><div class="flex flex-row gap-2 text-sm font-bold"><button>-</button><button>+</button></div></div><div><img><div></div></div><div class="flex w-14 flex-col gap-3 text-sm font-bold tracking-wide"><button></button><button>Load`);
var _tmpl$412 = /* @__PURE__ */ template(`<div class="flex h-7 w-4 items-center justify-center">=`);
var _tmpl$511 = /* @__PURE__ */ template(`<div class="h-5 w-5">`);
function FormationModal() {
  const selectedDollIds = createMemo(() => tempSelectedDolls.map((doll) => doll.id));
  const setNum = (dollId, num) => {
    setDollFortification((prev) => ({
      ...prev,
      [dollId]: num
    }));
  };
  const weapon = allWeapons[10];
  const confirm = async () => {
    setShowFormationModal(false);
    updateSelectedDolls();
  };
  return (() => {
    var _el$ = _tmpl$78(), _el$2 = _el$.firstChild;
    insert(_el$, createComponent(For, {
      each: tempSelectedDolls,
      children: (doll) => {
        const [savedLoadout, setSavedLoadout] = createSignal(false);
        const dollInfo = getInfoFromId(doll.id);
        if (!dollInfo) return null;
        const dollFortification2 = createMemo(() => doll.fortification || "\u2014");
        const dollRemolding = createMemo(() => "Lv." + doll.remoldingLvl);
        const dollWeapon = createMemo(() => {
          let gun = allWeapons.find((w) => w.id === doll.gun);
          if (!gun) gun = allWeapons.find((w) => w.imprintId === doll.id);
          if (!gun) gun = defaultWeapons[dollInfo.gunType];
          return gun;
        });
        const hasLoadout = createMemo(() => dollHasLoadout(doll.id));
        const keys = createMemo(() => displaySmallKeys(doll.id, doll.keys));
        return (() => {
          var _el$3 = _tmpl$318(), _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$8.nextSibling, _el$0 = _el$5.nextSibling, _el$1 = _el$0.firstChild, _el$10 = _el$1.firstChild, _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling, _el$13 = _el$10.nextSibling, _el$14 = _el$13.firstChild, _el$15 = _el$14.nextSibling, _el$16 = _el$1.nextSibling, _el$17 = _el$16.firstChild, _el$18 = _el$17.firstChild, _el$19 = _el$18.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$17.nextSibling, _el$22 = _el$21.firstChild, _el$23 = _el$22.nextSibling, _el$24 = _el$16.nextSibling, _el$27 = _el$24.firstChild, _el$28 = _el$27.nextSibling, _el$29 = _el$24.nextSibling, _el$30 = _el$29.firstChild, _el$31 = _el$30.nextSibling;
          insert(_el$3, createComponent(DynamicDollChip, {
            target: dollInfo,
            get doll() {
              return getDollFromSummon(dollInfo);
            }
          }), _el$4);
          _el$6.$$click = () => {
            setSelectedDoll(doll);
            setShowKeyModal(true);
            setSavedLoadout(false);
          };
          insert(_el$6, createComponent(For, {
            get each() {
              return keys();
            },
            children: (key) => typeof key === "string" ? _tmpl$412() : key ? (() => {
              var _el$33 = _tmpl$511();
              insert(_el$33, createComponent(SmallKey, {
                get rarity() {
                  return key.rarity;
                },
                get keyType() {
                  return key.type;
                }
              }));
              return _el$33;
            })() : null
          }));
          _el$7.$$click = () => changeBorrow(doll.id);
          insert(_el$8, createComponent(Check, {}));
          insert(_el$9, createComponent(Borrow, {}));
          insert(_el$11, createComponent(Fortification, {}));
          insert(_el$12, dollFortification2);
          _el$14.$$click = () => {
            setSavedLoadout(false);
            changeFortification(doll.id, -1);
          };
          _el$15.$$click = () => {
            setSavedLoadout(false);
            changeFortification(doll.id, 1);
          };
          insert(_el$20, dollRemolding);
          _el$22.$$click = () => {
            setSavedLoadout(false);
            changeRemoldingLvl(doll.id, -1);
          };
          _el$23.$$click = () => {
            setSavedLoadout(false);
            changeRemoldingLvl(doll.id, 1);
          };
          _el$24.$$click = () => {
            setSelectedDoll(doll);
            setShowWeaponModal(true);
            setSavedLoadout(false);
          };
          insert(_el$24, createComponent(Show, {
            get when() {
              return dollWeapon()?.imprintImage;
            },
            get children() {
              var _el$25 = _tmpl$225(), _el$26 = _el$25.firstChild;
              createRenderEffect(() => setAttribute(_el$26, "src", dollWeapon()?.imprintImage));
              return _el$25;
            }
          }), _el$27);
          _el$30.$$click = () => {
            setSavedLoadout(true);
            saveDollLoadout(doll.id);
          };
          insert(_el$30, () => savedLoadout() ? "Saved" : "Save");
          _el$31.$$click = () => dollHasLoadout(doll.id) && loadDollLoadout(doll.id);
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(false)} text-md flex h-10 grow flex-row items-center justify-center gap-1 rounded-sm bg-[#354346] p-1 shadow-sm shadow-black/50`, _v$2 = `${interactiveStyles(doll.borrow)} text-md flex h-10 flex-row items-center justify-center gap-1 rounded-sm bg-[#354346] p-1 shadow-sm shadow-black/50`, _v$3 = `${doll.borrow ? "opacity-100" : "opacity-20"} w-5`, _v$4 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$5 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$6 = dollInfo.remolding, _v$7 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$8 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$9 = `${interactiveStyles(false)} relative h-17 w-31.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50`, _v$0 = dollWeapon()?.localImagePath, _v$1 = `relative z-20 h-full w-full border-b-3 ${dollWeapon()?.rarity === "Elite" ? "border-[#DF9E00]" : "border-[#3291AB]"} object-cover`, _v$10 = `absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${dollWeapon()?.rarity === "Elite" ? "from-[#453824]" : "from-[#133843]"} from-0% to-transparent to-75%`, _v$11 = `${interactiveStyles(false)} rounded-sm bg-[#354346] px-2 py-1 shadow-sm shadow-black/50`, _v$12 = `${hasLoadout() ? interactiveStyles(false) : "opacity-50"} rounded-sm bg-[#354346] px-2 py-1 shadow-sm shadow-black/50`;
            _v$ !== _p$.e && className(_el$6, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$7, _p$.t = _v$2);
            _v$3 !== _p$.a && className(_el$8, _p$.a = _v$3);
            _v$4 !== _p$.o && className(_el$14, _p$.o = _v$4);
            _v$5 !== _p$.i && className(_el$15, _p$.i = _v$5);
            _v$6 !== _p$.n && setAttribute(_el$18, "src", _p$.n = _v$6);
            _v$7 !== _p$.s && className(_el$22, _p$.s = _v$7);
            _v$8 !== _p$.h && className(_el$23, _p$.h = _v$8);
            _v$9 !== _p$.r && className(_el$24, _p$.r = _v$9);
            _v$0 !== _p$.d && setAttribute(_el$27, "src", _p$.d = _v$0);
            _v$1 !== _p$.l && className(_el$27, _p$.l = _v$1);
            _v$10 !== _p$.u && className(_el$28, _p$.u = _v$10);
            _v$11 !== _p$.c && className(_el$30, _p$.c = _v$11);
            _v$12 !== _p$.w && className(_el$31, _p$.w = _v$12);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0,
            n: void 0,
            s: void 0,
            h: void 0,
            r: void 0,
            d: void 0,
            l: void 0,
            u: void 0,
            c: void 0,
            w: void 0
          });
          return _el$3;
        })();
      }
    }), _el$2);
    insert(_el$2, createComponent(Button, {
      onClick: confirm,
      color: "light",
      design: "confirm"
    }));
    createRenderEffect(() => className(_el$2, tempSelectedDolls.length % 2 === 1 ? "absolute right-10 bottom-8 flex justify-end gap-3" : "flex grow justify-end gap-3"));
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/icons/EmptyKey.tsx
var _tmpl$79 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 62 62"version=1.1 xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink xml:space=preserve xmlns:serif=http://www.serif.com/ style=fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5><g transform=matrix(1.20833,0,0,1.38095,-22.1667,-18.7143)><ellipse cx=44 cy=36 rx=24 ry=21></ellipse></g><g transform=matrix(2,0,0,1,-29,0.5)><path d=M29,32.5L24.75,32.5L24.75,28.5L29,28.5L29,20L31,20L31,28.5L35.25,28.5L35.25,32.5L31,32.5L31,41L29,41L29,32.5Z>`);
function EmptyKey(props) {
  return (() => {
    var _el$ = _tmpl$79(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.firstChild;
    createRenderEffect((_p$) => {
      var _v$ = props.color === "Light" ? "fill:#6D6A78;stroke:#918E9C;stroke-width:1.54px;" : "fill:rgb(33,49,57);stroke:rgb(56,75,83);stroke-width:1.54px;", _v$2 = props.color === "Light" ? "fill:#C9C8CE;" : "fill:rgb(56,75,83);";
      _p$.e = style(_el$3, _v$, _p$.e);
      _p$.t = style(_el$5, _v$2, _p$.t);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}

// src/components/modals/KeyModal.tsx
var _tmpl$80 = /* @__PURE__ */ template(`<div class="flex max-h-180 flex-row px-10"><div class="flex w-30 shrink-0 flex-col items-stretch justify-center bg-[#2A3D46] py-5"><div class="flex justify-center pb-2"><img loading=lazy class="h-15 w-15 rounded-full border-3 border-[#687177] bg-[#0D1C1C] object-cover"></div></div><div class="flex w-70 grow flex-col"><div class="font-bold h-8 p-2 pl-4 flex shrink-0"></div><div class="flex grow overflow-y-auto p-5 px-4 pt-2"><div class="flex flex-row flex-wrap items-start gap-3.5"></div></div><div class="flex justify-end p-2">`, true, false, false);
var _tmpl$226 = /* @__PURE__ */ template(`<img class="h-16 w-16 object-cover">`);
var _tmpl$319 = /* @__PURE__ */ template(`<div><div class="h-15 w-15">`);
var _tmpl$413 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 z-20 h-7 w-7 shadow-sm shadow-black/20">`);
var _tmpl$512 = /* @__PURE__ */ template(`<div class="absolute right-1 bottom-1 rounded-sm bg-[#2A3D46] px-1 text-xs font-bold text-[#EFEFEF]">`);
var _tmpl$610 = /* @__PURE__ */ template(`<div><div><img class="h-22 w-22 object-cover">`);
var _tmpl$710 = /* @__PURE__ */ template(`<div class="absolute right-1 bottom-2 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]"><div class="relative -top-1 -left-2.5 w-12"><img class="w-full object-cover object-top">`);
function KeyModal() {
  const dollInfo = createMemo(() => getInfoFromId(selectedDoll().id));
  if (!dollInfo()) return null;
  const selectedKeys = createMemo(() => sortEquippedKeys(selectedDoll().id, selectedDoll().keys));
  const keyMapping = ["Fixed Key", "Fixed Key", "Fixed Key", "Expansion Key", "Affinity Key", "Common Key", "Common Key", "Common Key"];
  const keyTypes = {
    "Fixed Key": [],
    "Expansion Key": [],
    "Affinity Key": [...allKeys.affinity],
    "Common Key": [...allKeys.common]
  };
  keyTypes["Fixed Key"].push(...dollInfo().keys.filter((k) => k.type === "Fixed Key"));
  keyTypes["Expansion Key"].push(...dollInfo().keys.filter((k) => k.type === "Expansion Key"));
  const [activeKeySlot, setActiveKeySlot] = createSignal(0);
  const keyTitle = createMemo(() => selectedKeys()[activeKeySlot()]?.name ?? "");
  const visibleKeys = createMemo(() => {
    const isSel = (keyId) => {
      return selectedDoll().keys.includes(keyId);
    };
    return keyTypes[keyMapping[activeKeySlot()]].sort((a, b) => +isSel(b.id) - +isSel(a.id) || (a.number || 0) - (b.number || 0) || "dollName" in a && "dollName" in b && a.dollName.localeCompare(b.dollName) || a.name.localeCompare(b.name));
  });
  return (() => {
    var _el$ = _tmpl$80(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$2.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling;
    insert(_el$2, createComponent(For, {
      get each() {
        return selectedKeys();
      },
      children: (selectedKey, index) => {
        if (dollInfo().hasExpansionKey === false && index() === 3) return null;
        const isSel = () => activeKeySlot() === index();
        const selectedStyle = "border-[#F26C1C] bg-linear-to-r from-[#5B403E] to-transparent scale-107";
        const unselectedStyle = "cursor-pointer transition-discrete duration-175 hover:scale-107 border-transparent hover:border-white bg-linear-to-r from-transparent hover:from-[#515B61] to-transparent";
        return (() => {
          var _el$0 = _tmpl$319(), _el$1 = _el$0.firstChild;
          _el$0.$$click = () => setActiveKeySlot(index());
          insert(_el$1, createComponent(Show, {
            when: selectedKey,
            get fallback() {
              return createComponent(EmptyKey, {
                get color() {
                  return isSel() ? "Light" : "Dark";
                }
              });
            },
            get children() {
              var _el$10 = _tmpl$226();
              createRenderEffect(() => setAttribute(_el$10, "src", selectedKey.localImagePath));
              return _el$10;
            }
          }));
          createRenderEffect(() => className(_el$0, `flex justify-center border-l-4 py-2 ${isSel() ? selectedStyle : unselectedStyle}`));
          return _el$0;
        })();
      }
    }), null);
    insert(_el$6, keyTitle);
    insert(_el$8, createComponent(For, {
      get each() {
        return visibleKeys();
      },
      children: (key) => {
        const isSel = () => {
          return selectedDoll().keys.includes(key.id);
        };
        const toggleKey = () => {
          const index = selectedDoll().keys.indexOf(key.id);
          if (index > -1) {
            setDollKey(selectedDoll().id, index, null);
          } else {
            setDollKey(selectedDoll().id, activeKeySlot(), key.id);
          }
        };
        return (() => {
          var _el$11 = _tmpl$610(), _el$13 = _el$11.firstChild, _el$14 = _el$13.firstChild;
          _el$11.$$click = toggleKey;
          insert(_el$11, createComponent(Show, {
            get when() {
              return isSel();
            },
            get children() {
              var _el$12 = _tmpl$413();
              insert(_el$12, createComponent(Check, {}));
              return _el$12;
            }
          }), _el$13);
          insert(_el$13, createComponent(Show, {
            get when() {
              return key.number !== null;
            },
            get children() {
              var _el$15 = _tmpl$512();
              insert(_el$15, () => key.number);
              return _el$15;
            }
          }), null);
          insert(_el$13, (() => {
            var _c$ = memo(() => "dollAvatar" in key);
            return () => _c$() && (() => {
              var _el$16 = _tmpl$710(), _el$17 = _el$16.firstChild, _el$18 = _el$17.firstChild;
              createRenderEffect(() => setAttribute(_el$18, "src", key.dollAvatar));
              return _el$16;
            })();
          })(), null);
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(isSel())} inset-shadow-2xl relative flex flex-col rounded-sm border-3 border-[#B2B1B6] bg-[#95999B] shadow-black/75`, _v$2 = `${key.rarity === "Elite" ? "border-[#DF9E00]" : "border-[#7968BA]"} relative border-b-5`, _v$3 = key.localImagePath;
            _v$ !== _p$.e && className(_el$11, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$13, _p$.t = _v$2);
            _v$3 !== _p$.a && setAttribute(_el$14, "src", _p$.a = _v$3);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$11;
        })();
      }
    }));
    insert(_el$9, createComponent(Button, {
      onClick: () => {
        setShowKeyModal(false);
      },
      color: "light",
      design: "confirm"
    }));
    createRenderEffect(() => setAttribute(_el$4, "src", dollInfo().avatar));
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/modals/WeaponModal.tsx
var _tmpl$81 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="flex flex-row flex-wrap gap-4">`);
var _tmpl$227 = /* @__PURE__ */ template(`<div class="absolute bottom-1 left-2 z-20 h-12 w-12"><img class="relative h-full w-full object-cover">`);
var _tmpl$320 = /* @__PURE__ */ template(`<div><div></div><img><div>`);
var _tmpl$414 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function WeaponModal() {
  const dollInfo = createMemo(() => getInfoFromId(selectedDoll().id));
  if (!dollInfo()) return null;
  const dollWeapon = createMemo(() => {
    let gun = allWeapons.find((w) => w.id === selectedDoll().gun);
    if (!gun) gun = allWeapons.find((w) => w.imprintId === selectedDoll().id);
    if (!gun) gun = defaultWeapons[dollInfo().gunType];
    return gun;
  });
  const [selectedWeaponId, setSelectedWeaponId] = createSignal(dollWeapon()?.id ?? "");
  const visibleWeapons = allWeapons.filter((weapon) => weapon.type === dollInfo().gunType);
  return [createComponent(ModalHeader, {
    title: "Select Weapon"
  }), (() => {
    var _el$ = _tmpl$81(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(For, {
      each: visibleWeapons,
      children: (weapon) => {
        const isSel = () => selectedWeaponId() === weapon.id;
        return (() => {
          var _el$3 = _tmpl$320(), _el$6 = _el$3.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.nextSibling;
          _el$3.$$click = () => setSelectedWeaponId(weapon.id);
          insert(_el$3, (() => {
            var _c$ = memo(() => !!isSel());
            return () => _c$() && (() => {
              var _el$9 = _tmpl$414();
              insert(_el$9, createComponent(Check, {}));
              return _el$9;
            })();
          })(), _el$6);
          insert(_el$3, createComponent(Show, {
            get when() {
              return weapon.imprintImage;
            },
            get children() {
              var _el$4 = _tmpl$227(), _el$5 = _el$4.firstChild;
              createRenderEffect(() => setAttribute(_el$5, "src", weapon.imprintImage));
              return _el$4;
            }
          }), _el$6);
          insert(_el$6, () => weapon.name);
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(isSel())} relative flex h-25.5 w-48.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50`, _v$2 = `absolute bottom-1 z-20 w-full text-right font-bold ${weapon.imprintId === null ? "pl-2" : "pl-15"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`, _v$3 = weapon.localImagePath, _v$4 = `relative z-10 h-full w-full border-b-3 ${weapon.rarity === "Elite" ? "border-[#DF9E00]" : "border-[#3291AB]"} object-cover`, _v$5 = `absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${weapon.rarity === "Elite" ? "from-[#453824]" : "from-[#133843]"} from-0% to-transparent to-75%`;
            _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$6, _p$.t = _v$2);
            _v$3 !== _p$.a && setAttribute(_el$7, "src", _p$.a = _v$3);
            _v$4 !== _p$.o && className(_el$7, _p$.o = _v$4);
            _v$5 !== _p$.i && className(_el$8, _p$.i = _v$5);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0
          });
          return _el$3;
        })();
      }
    }));
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setShowWeaponModal(false),
        color: "dark",
        design: "cancel"
      }), createComponent(Button, {
        onClick: () => {
          setShowWeaponModal(false);
          setDollWeapon(selectedDoll().id, selectedWeaponId());
        },
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["click"]);

// src/components/modals/DarkModal.tsx
var _tmpl$85 = /* @__PURE__ */ template(`<div>`);
function DarkModal(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$85();
    insert(_el$, resolved);
    createRenderEffect(() => className(_el$, `${props.width ?? "w-225"} ${props.hide ? "hidden" : ""} flex flex-col overflow-hidden rounded-sm border-t-4 border-[#3E5356] bg-[#2C373B] shadow-2xl`));
    return _el$;
  })();
}

// src/components/modals/BuffModal.tsx
var _tmpl$86 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="flex flex-row flex-wrap gap-4">`);
var _tmpl$228 = /* @__PURE__ */ template(`<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Select one or more buffs relevant to this transcript`);
var _tmpl$321 = /* @__PURE__ */ template(`<div><div><img class="relative z-20 h-full w-full object-cover"></div><div class="flex grow flex-col gap-3 text-[#384B53]"><div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]"><div class="text-left font-bold text-black"></div><div class=text-left></div></div><div class=text-left>`);
var _tmpl$415 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function BuffModal() {
  const [selectedBuffs, setSelectedBuffs] = createSignal([...state.buffs]);
  const sortedBuffs = [...allBuffs].sort(sortBuffs);
  return [createComponent(ModalHeader, {
    title: "Select Seasonal Buffs"
  }), (() => {
    var _el$ = _tmpl$86(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(For, {
      each: sortedBuffs,
      children: (buff) => {
        const isSel = () => selectedBuffs().includes(buff.id);
        const toggleBuff = () => setSelectedBuffs((buffs) => selectedBuffs().includes(buff.id) ? selectedBuffs().filter((b) => b !== buff.id) : [...buffs, buff.id]);
        const days = () => {
          if (buff.core && buff.season === CURRENT_SEASON) {
            return "Effective this season";
          }
          if (buff.days && buff.days[CURRENT_SEASON]) {
            return "Available on days " + buff.days[CURRENT_SEASON].map((day) => day + 1).join(", ");
          }
          return "Unavailable this gunsmoke season";
        };
        return (() => {
          var _el$4 = _tmpl$321(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling, _el$1 = _el$8.nextSibling;
          _el$4.$$click = () => toggleBuff();
          insert(_el$4, (() => {
            var _c$ = memo(() => !!isSel());
            return () => _c$() && (() => {
              var _el$10 = _tmpl$415();
              insert(_el$10, createComponent(Check, {}));
              return _el$10;
            })();
          })(), _el$5);
          insert(_el$9, () => buff.name);
          insert(_el$0, days);
          insert(_el$1, createComponent(Buffs, {
            get id() {
              return buff.id;
            }
          }));
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(isSel())} relative flex grow flex-row items-start gap-3 rounded-sm bg-[#F2EEF8] p-2.5 shadow-sm shadow-black/20 hover:scale-100!`, _v$2 = `relative flex h-15 w-15 shrink-0 ${buff.core ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`, _v$3 = buff.localImagePath;
            _v$ !== _p$.e && className(_el$4, _p$.e = _v$);
            _v$2 !== _p$.t && className(_el$5, _p$.t = _v$2);
            _v$3 !== _p$.a && setAttribute(_el$6, "src", _p$.a = _v$3);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$4;
        })();
      }
    }));
    return _el$;
  })(), _tmpl$228(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setShowBuffModal(false),
        color: "dark",
        design: "cancel"
      }), createComponent(Button, {
        onClick: () => {
          setShowBuffModal(false);
          setBuffs(selectedBuffs());
        },
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["click"]);

// node_modules/@solid-primitives/deep/dist/track-store.js
var EQUALS_FALSE = { equals: false };
var TrackStoreCache = /* @__PURE__ */ new WeakMap();
var TrackVersion = 0;
function getTrackStoreNode(node) {
  let track = TrackStoreCache.get(node);
  if (!track) {
    createRoot(() => {
      const unwrapped = unwrap(node);
      let is_reading = false;
      let is_stale = true;
      let version = 0;
      const [signal, trigger] = createSignal(void 0, EQUALS_FALSE);
      const memo2 = createMemo(() => {
        if (is_reading) {
          node[$TRACK];
          for (const [key, child] of Object.entries(unwrapped)) {
            let childNode;
            if (child != null && typeof child === "object" && ((childNode = child[$PROXY]) || $TRACK in (childNode = untrack(() => node[key])))) {
              getTrackStoreNode(childNode)?.();
            }
          }
        } else {
          signal();
          is_stale = true;
        }
      }, void 0, EQUALS_FALSE);
      track = () => {
        is_reading = true;
        if (is_stale) {
          trigger();
          is_stale = false;
        }
        const already_tracked = version === TrackVersion;
        version = TrackVersion;
        already_tracked || memo2();
        is_reading = false;
      };
      TrackStoreCache.set(node, track);
    });
  }
  return track;
}
function trackStore(store) {
  TrackVersion++;
  $TRACK in store && getTrackStoreNode(store)?.();
  return store;
}

// src/App.tsx
var _tmpl$87 = /* @__PURE__ */ template(`<div class="flex h-screen flex-col bg-zinc-950 text-white"><div class="relative flex-1 overflow-hidden"id=body>`);
function App() {
  onMount(async () => {
    await loadCombinedJson();
    loadEditorMap();
    migrate();
    const params = new URLSearchParams(window.location.search);
    if (params.has("state")) {
      setStateFromURL(true);
      await importState(loadFromString, params.get("state"));
    } else if (params.has("stateId")) {
      setStateFromURL(true);
      await importState(loadFromWorker, params.get("stateId"));
    } else {
      await importState(loadFromLocalStorage, "");
    }
    setTimeout(() => setLoaded(true), 0);
    window.addEventListener("focus", function(e) {
      setStateHashMatch(compareStateHash(state));
    });
    createEffect(() => {
      trackStore(state);
      setTimeout(() => {
        setStateHashMatch(compareStateHash(state));
      }, 0);
    });
  });
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
    var _el$ = _tmpl$87(), _el$2 = _el$.firstChild;
    insert(_el$, createComponent(TabBar, {
      onTabChange: handleTabChange
    }), _el$2);
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => !!isArenaTab())() && loaded();
      },
      get children() {
        return createComponent(ArenaCanvas, {});
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
        return memo(() => !!showFormationModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return [createComponent(DarkModal, {
              get hide() {
                return hideFormationModal();
              },
              width: "w-[988px]",
              get children() {
                return createComponent(FormationModal, {});
              }
            }), createComponent(Show, {
              get when() {
                return memo(() => !!showKeyModal())() && loaded();
              },
              get children() {
                return createComponent(DarkModal, {
                  get children() {
                    return createComponent(KeyModal, {});
                  }
                });
              }
            }), createComponent(Show, {
              get when() {
                return memo(() => !!showWeaponModal())() && loaded();
              },
              get children() {
                return createComponent(Modal, {
                  get children() {
                    return createComponent(WeaponModal, {});
                  }
                });
              }
            })];
          }
        });
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showBuffModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              get children() {
                return createComponent(BuffModal, {});
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
              width: "w-[460px]",
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

// src/index.tsx
var root = document.getElementById("root");
if (!root) throw new Error("No #root element found");
render(() => createComponent(App, {}), root);
new EventSource("/esbuild").addEventListener("change", () => location.reload());
