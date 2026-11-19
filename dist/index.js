var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __using = (stack, value, async) => {
  if (value != null) {
    if (typeof value !== "object" && typeof value !== "function") __typeError("Object expected");
    var dispose2, inner;
    if (async) dispose2 = value[__knownSymbol("asyncDispose")];
    if (dispose2 === void 0) {
      dispose2 = value[__knownSymbol("dispose")];
      if (async) inner = dispose2;
    }
    if (typeof dispose2 !== "function") __typeError("Object not disposable");
    if (inner) dispose2 = function() {
      try {
        inner.call(this);
      } catch (e) {
        return Promise.reject(e);
      }
    };
    stack.push([async, dispose2, value]);
  } else if (async) {
    stack.push([async]);
  }
  return value;
};
var __callDispose = (stack, error, hasError) => {
  var E = typeof SuppressedError === "function" ? SuppressedError : function(e, s, m, _) {
    return _ = Error(m), _.name = "SuppressedError", _.error = e, _.suppressed = s, _;
  };
  var fail = (e) => error = hasError ? new E(e, error, "An error was suppressed during disposal") : (hasError = true, e);
  var next = (it) => {
    while (it = stack.pop()) {
      try {
        var result = it[1] && it[1].call(it[2]);
        if (it[0]) return Promise.resolve(result).then(next, (e) => (fail(e), next()));
      } catch (e) {
        fail(e);
      }
    }
    if (hasError) throw error;
  };
  return next();
};

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
  const isArray2 = Array.isArray(deps);
  let prevInput;
  let defer = options && options.defer;
  return (prevValue) => {
    let input;
    if (isArray2) {
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
    const observers = this.observers;
    if (!observers || observers[observers.length - 1] !== Listener) {
      const sSlot = observers ? observers.length : 0;
      if (!Listener.sources) {
        Listener.sources = [this];
        Listener.sourceSlots = [sSlot];
      } else {
        Listener.sources.push(this);
        Listener.sourceSlots.push(sSlot);
      }
      if (!observers) {
        this.observers = [Listener];
        this.observerSlots = [Listener.sources.length - 1];
      } else {
        observers.push(Listener);
        this.observerSlots.push(Listener.sources.length - 1);
      }
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
    let trackedOrdinary = false;
    const triggerInTransition = () => startTransition(trigger).then(() => {
      if (inTransition) {
        inTransition.dispose();
        inTransition = void 0;
        if (!trackedOrdinary) trigger();
      }
    });
    c.fn = (x) => {
      track();
      if (Transition && Transition.running) {
        if (!inTransition) inTransition = ExternalSourceConfig.factory(sourceFn, triggerInTransition);
        return inTransition.track(x);
      }
      trackedOrdinary = true;
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
      if (Array.isArray(result)) {
        if (result.length < 32768) results.push.apply(results, result);
        else for (let j = 0; j < result.length; j++) results.push(result[j]);
      } else {
        results.push(result);
      }
    }
    return results;
  }
  return children2;
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
    element === document ? code() : insert(element, code(), !init && element.firstChild ? null : void 0, init);
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
  try {
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
  } finally {
    e = node = null;
  }
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
      onCleanup(() => el.contains(container) && el.removeChild(container));
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
      const keys = Object.keys(value), desc = Object.getOwnPropertyDescriptors(value), proto = Object.getPrototypeOf(value);
      const isClass = proto !== null && value !== null && typeof value === "object" && !Array.isArray(value) && proto !== Object.prototype;
      if (isClass) {
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        keys.push(...Object.keys(descriptors));
        Object.assign(desc, descriptors);
      }
      for (let i = 0, l = keys.length; i < l; i++) {
        const prop = keys[i];
        if (isClass && prop === "constructor") continue;
        if (desc[prop].get) {
          Object.defineProperty(value, prop, {
            configurable: true,
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
      if (getListener() && (typeof value !== "function" || Object.prototype.hasOwnProperty.call(target, property)) && !(desc && desc.get)) value = getNode(nodes, property, value)();
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
  if (property === "__proto__") {
    console.warn(`Refusing to set "__proto__" on a store.`);
    return;
  }
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
    if (isUnsafeKey$1(key)) continue;
    setProperty(state2, key, value[key]);
  }
}
function isUnsafeKey$1(property) {
  return property === "__proto__" || property === "constructor" || property === "prototype";
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
    const partType = typeof part, isArray2 = Array.isArray(current);
    if (partType === "string" && (part === "__proto__" || path.length > 1 && isUnsafeKey$1(part))) {
      console.warn(`Refusing to traverse unsafe key "${part}" on a store.`);
      return;
    }
    if (Array.isArray(part)) {
      for (let i = 0; i < part.length; i++) {
        updatePath(current, [part[i]].concat(path), traversed);
      }
      return;
    } else if (isArray2 && partType === "function") {
      for (let i = 0; i < current.length; i++) {
        if (part(current[i], i)) updatePath(current, [i].concat(path), traversed);
      }
      return;
    } else if (isArray2 && partType === "object") {
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
  const isArray2 = Array.isArray(unwrappedStore);
  if (typeof unwrappedStore !== "object" && typeof unwrappedStore !== "function") throw new Error(`Unexpected type ${typeof unwrappedStore} received when initializing 'createStore'. Expected an object.`);
  const wrappedStore = wrap$1(unwrappedStore);
  DEV.registerGraph({
    value: unwrappedStore,
    name: options && options.name
  });
  function setStore(...args) {
    batch(() => {
      isArray2 && args.length === 1 ? updateArray(unwrappedStore, args[0]) : updatePath(unwrappedStore, args);
    });
  }
  return [wrappedStore, setStore];
}
var $ROOT = /* @__PURE__ */ Symbol("store-root");
function isUnsafeKey(property) {
  return property === "__proto__" || property === "constructor" || property === "prototype";
}
function applyState(target, parent, property, merge, key) {
  if (isUnsafeKey(property)) return;
  const previous = parent[property];
  if (target === previous) return;
  const isArray2 = Array.isArray(target);
  if (property !== $ROOT && (!isWrappable(target) || !isWrappable(previous) || isArray2 !== Array.isArray(previous) || key && target[key] !== previous[key])) {
    setProperty(parent, property, target);
    return;
  }
  if (isArray2) {
    if (target.length && previous.length && (!merge || key && target[0] && target[0][key] != null)) {
      let i, j, start, end, newEnd, item, newIndicesNext, keyVal;
      for (start = 0, end = Math.min(previous.length, target.length); start < end && (previous[start] === target[start] || key && previous[start] && target[start] && previous[start][key] && previous[start][key] === target[start][key]); start++) {
        applyState(target[start], previous, start, merge, key);
      }
      const temp = new Array(target.length), newIndices = /* @__PURE__ */ new Map();
      for (end = previous.length - 1, newEnd = target.length - 1; end >= start && newEnd >= start && (previous[end] === target[newEnd] || key && previous[end] && target[newEnd] && previous[end][key] && previous[end][key] === target[newEnd][key]); end--, newEnd--) {
        temp[newEnd] = previous[end];
      }
      if (start > newEnd || start > end) {
        for (j = start; j <= newEnd; j++) setProperty(previous, j, target[j]);
        for (; j < target.length; j++) {
          setProperty(previous, j, temp[j]);
          applyState(target[j], previous, j, merge, key);
        }
        if (previous.length > target.length) setProperty(previous, "length", target.length);
        return;
      }
      newIndicesNext = new Array(newEnd + 1);
      for (j = newEnd; j >= start; j--) {
        item = target[j];
        keyVal = key && item ? item[key] : item;
        i = newIndices.get(keyVal);
        newIndicesNext[j] = i === void 0 ? -1 : i;
        newIndices.set(keyVal, j);
      }
      for (i = start; i <= end; i++) {
        item = previous[i];
        keyVal = key && item ? item[key] : item;
        j = newIndices.get(keyVal);
        if (j !== void 0 && j !== -1) {
          temp[j] = previous[i];
          j = newIndicesNext[j];
          newIndices.set(keyVal, j);
        }
      }
      for (j = start; j < target.length; j++) {
        if (j in temp) {
          setProperty(previous, j, temp[j]);
          applyState(target[j], previous, j, merge, key);
        } else setProperty(previous, j, target[j]);
      }
    } else {
      for (let i = 0, len = target.length; i < len; i++) {
        applyState(target[i], previous, i, merge, key);
      }
    }
    if (previous.length > target.length) setProperty(previous, "length", target.length);
    return;
  }
  const targetKeys = Object.keys(target);
  for (let i = 0, len = targetKeys.length; i < len; i++) {
    if (isUnsafeKey(targetKeys[i])) continue;
    applyState(target[targetKeys[i]], previous, targetKeys[i], merge, key);
  }
  const previousKeys = Object.keys(previous);
  for (let i = 0, len = previousKeys.length; i < len; i++) {
    if (target[previousKeys[i]] === void 0) setProperty(previous, previousKeys[i], void 0);
  }
}
function reconcile(value, options = {}) {
  const {
    merge,
    key = "id"
  } = options, v = unwrap(value);
  return (state2) => {
    if (!isWrappable(state2) || !isWrappable(v)) return v;
    const res = applyState(v, {
      [$ROOT]: state2
    }, $ROOT, merge, key);
    return res === void 0 ? state2 : res;
  };
}
var producers = /* @__PURE__ */ new WeakMap();
var setterTraps = {
  get(target, property) {
    if (property === $RAW) return target;
    const value = target[property];
    if (property === $PROXY || property === $TRACK || property === $NODE || property === $HAS || property === "__proto__") return value;
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

// src/components/buttons/DarkCancel.tsx
var _tmpl$ = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=dark transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(53,65,71)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.97021,0,0,2.97021,-213.585,-174.637)><g transform=matrix(0.795495,-0.795495,0.819601,0.819601,-49.0332,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)></path></g><g transform=matrix(-0.795495,-0.795495,-0.819601,0.819601,265.742,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)>`);
function DarkCancel() {
  return _tmpl$();
}

// src/components/buttons/DarkConfirm.tsx
var _tmpl$2 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5><g id=dark transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(53,65,71)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(1.15789,0,0,1.06452,-47.4868,-24.4244)><ellipse cx=134.5 cy=115 rx=28.5 ry=31 style=fill:none;stroke:rgb(241,176,20);stroke-width:10.79px>`);
function DarkConfirm() {
  return _tmpl$2();
}

// src/components/buttons/DarkRefresh.tsx
var _tmpl$3 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=dark transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(53,65,71)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.24134,0,0,2.36286,19.1672,-104.192)><path d="M50.621,80.491C48.658,76.796 44.621,74.259 39.965,74.259C34.777,74.259 30.358,77.409 28.72,81.8L22.548,81.8C24.379,74.598 31.338,69.232 39.634,69.232C45.874,69.232 51.358,72.268 54.471,76.838L57.19,74.259L57.19,85.571L45.265,85.571L50.621,80.491ZM22.077,85.571L34.002,85.571L29.095,90.226C30.967,94.15 35.132,96.883 39.965,96.883C45.153,96.883 49.572,93.733 51.21,89.342L56.72,89.342C54.889,96.544 47.929,101.91 39.634,101.91C33.394,101.91 27.91,98.874 24.796,94.304L22.077,96.883L22.077,85.571Z"style=fill:rgb(217,218,218)>`);
function DarkRefresh() {
  return _tmpl$3();
}

// src/components/buttons/LightCancel.tsx
var _tmpl$4 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=light transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(162,161,166)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.97021,0,0,2.97021,-213.585,-174.637)><g transform=matrix(0.795495,-0.795495,0.819601,0.819601,-49.0332,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)></path></g><g transform=matrix(-0.795495,-0.795495,-0.819601,0.819601,265.742,95.093)><path d="M103,84.941L103,103.059C103,104.13 102.104,105 101,105C99.896,105 99,104.13 99,103.059L99,84.941C99,83.87 99.896,83 101,83C102.104,83 103,83.87 103,84.941Z"style=fill:rgb(221,221,221)>`);
function LightCancel() {
  return _tmpl$4();
}

// src/components/buttons/LightConfirm.tsx
var _tmpl$5 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5><g id=light transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(162,161,166)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(1.15789,0,0,1.06452,-47.4868,-24.4244)><ellipse cx=134.5 cy=115 rx=28.5 ry=31 style=fill:none;stroke:rgb(241,176,20);stroke-width:10.79px>`);
function LightConfirm() {
  return _tmpl$5();
}

// src/components/buttons/LightRefresh.tsx
var _tmpl$6 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 214 196"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=light transform=matrix(0.817581,0,0,0.917124,-0.25,-7.6852)><path d="M130.874,205.644L130.874,222.091L0,222.091L0,8.38L130.874,8.38L130.874,24.816C128.53,24.977 126.217,25.602 124.115,26.692L50.611,64.796C45.715,67.334 42.704,72.001 42.704,77.049L42.704,153.425C42.704,158.471 45.714,163.137 50.608,165.673L124.076,203.758C126.19,204.854 128.516,205.483 130.874,205.644Z"style=fill:rgb(162,161,166)></path></g><g transform=matrix(1.13505,0,0,0.988972,-67.7694,-14.9109)><path d="M149.313,47.248C152.874,44.863 157.278,44.863 160.839,47.248C171.03,54.07 192.11,68.183 202.248,74.971C205.771,77.329 207.937,81.658 207.937,86.339C207.937,99.943 207.937,128.395 207.937,142C207.937,146.681 205.771,151.011 202.247,153.37C192.118,160.151 171.069,174.244 160.868,181.073C157.289,183.469 152.864,183.469 149.285,181.073C139.08,174.241 118.02,160.141 107.895,153.363C104.378,151.008 102.215,146.687 102.215,142.013C102.215,128.411 102.215,99.934 102.215,86.329C102.215,81.654 104.379,77.331 107.897,74.976C118.032,68.19 139.12,54.072 149.313,47.248Z"style=fill:rgb(65,82,89)></path></g><g transform=matrix(2.24134,0,0,2.36286,19.1672,-104.192)><path d="M50.621,80.491C48.658,76.796 44.621,74.259 39.965,74.259C34.777,74.259 30.358,77.409 28.72,81.8L22.548,81.8C24.379,74.598 31.338,69.232 39.634,69.232C45.874,69.232 51.358,72.268 54.471,76.838L57.19,74.259L57.19,85.571L45.265,85.571L50.621,80.491ZM22.077,85.571L34.002,85.571L29.095,90.226C30.967,94.15 35.132,96.883 39.965,96.883C45.153,96.883 49.572,93.733 51.21,89.342L56.72,89.342C54.889,96.544 47.929,101.91 39.634,101.91C33.394,101.91 27.91,98.874 24.796,94.304L22.077,96.883L22.077,85.571Z"style=fill:rgb(217,218,218)>`);
function LightRefresh() {
  return _tmpl$6();
}

// src/components/buttons/Button.tsx
var _tmpl$7 = /* @__PURE__ */ template(`<div class="flex h-full shrink">`);
var _tmpl$22 = /* @__PURE__ */ template(`<span class="ml-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#EFEFEF] px-1.5 text-sm text-[#944040]">`);
var _tmpl$32 = /* @__PURE__ */ template(`<button><span>`);
function Button(props) {
  return (() => {
    var _el$ = _tmpl$32(), _el$3 = _el$.firstChild;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.design !== "custom";
      },
      get children() {
        var _el$2 = _tmpl$7();
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
    insert(_el$, createComponent(Show, {
      get when() {
        return props.badge !== void 0;
      },
      get children() {
        var _el$4 = _tmpl$22();
        insert(_el$4, () => props.badge);
        return _el$4;
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

// gfl2-data/enums.ts
var GunTypeLabels = [
  "",
  "HG",
  "SMG",
  "RF",
  "AR",
  "MG",
  "SG",
  "Blade"
];
var PhaseLabels = [
  "",
  "Physical",
  "Burn",
  "Corrosion",
  "Electric",
  "Freeze",
  "Hydro",
  "Resonance",
  "All"
];
var KeyTypeLabels = [
  "",
  "Fixed Key",
  "Common Key",
  "Expansion Key",
  "Affinity Key"
];
var SkillTypeLabels = [
  "",
  "Basic Attack",
  "Ultimate",
  "Skill 1",
  "Skill 2",
  "Passive",
  "Skill A",
  "Skill B",
  "Skill C",
  "Fixed Key",
  "Skill E",
  "Self Passive",
  "Move",
  "End Turn",
  "HOC Skill"
];
var SkillSelectLabels = [
  "",
  "Enemy",
  "Trap",
  "Tile",
  "Self",
  "Direction",
  "Ally",
  "Occupied Tile",
  "Other Allied Doll",
  "Non-summon Enemy",
  "Tile Near Target",
  "Typed Tile"
];
var Color = [
  "",
  "#3487e0",
  "#f26c1c",
  "#42cce0",
  "#d4ae08",
  "#8679e8",
  "#e67129",
  "#2caadb",
  "#e52955FF"
];
function expandRichText(text) {
  return text.replace(/<c(\d+)>/g, (_, i) => `<span style="color: ${Color[Number(i)]}">`).replace(/<\/c>/g, "</span>");
}

// src/types/constants.ts
var MAP_WIDTH = 18;
var MAP_HEIGHT = 22;
var TILE_SIZE = 32;
var MAX_MAP_SIZE = 25;
var MIN_MAP_SIZE = 3;
var MAP_SLOT_COUNT = 5;
var E_PAD = 6;
var HALF_HEIGHT = Math.round(TILE_SIZE * 0.15);
var FULL_HEIGHT = Math.round(TILE_SIZE * 0.35);
var END_TURN_SKILL_ID = -1;
var FORTIFICATION_LEVELS = [0, 1, 2, 3, 4, 5, 6];
var KEY_SLOTS = [
  1 /* FixedKey */,
  1 /* FixedKey */,
  1 /* FixedKey */,
  3 /* ExpansionKey */,
  4 /* AffinityKey */,
  2 /* CommonKey */,
  2 /* CommonKey */,
  2 /* CommonKey */
];
var EXTRA_KEY_COPIES = {
  [2 /* CommonKey */]: 0,
  [4 /* AffinityKey */]: 0
};
var MAX_TEAM_SIZE = 5;
var REMOLDING_LEVELS = [1, 10, 20, 30, 45, 60];
var V9_END_TURN_SKILL_ID = `${"s" /* Skills */}-1`;
var V7_SAVE_VERSION = 7;
var V7_STORAGE_KEY = "arenaPlannerState_v" + String(V7_SAVE_VERSION);
var V7_EDITOR_MAP_KEY = "arenaEditorMap_v2";
var V7_SKILL_DISPLAY_KEY = "arenaSkillDisplay_v1";
var V8_SAVE_VERSION = 8;
var V8_STORAGE_KEY = "gunsmoke_state_v" + String(V8_SAVE_VERSION);
var V8_SKILL_DISPLAY_KEY = "gunsmoke_skills_v" + String(V8_SAVE_VERSION);
var V8_CUSTOM_MAP_KEY = "gunsmoke_custom_map_v" + String(V8_SAVE_VERSION);
var V9_SAVE_VERSION = 9;
var V9_STORAGE_KEY = "gunsmoke_state_v" + String(V9_SAVE_VERSION);
var V9_LOCAL_STATE = "gunsmoke_localstate_v" + String(V9_SAVE_VERSION);
var V9_DOLL_LOADOUT_KEY = (dollId) => `gunsmoke_doll_${dollId}_v${V9_SAVE_VERSION}`;
var V10_SAVE_VERSION = 10;
var V10_STORAGE_KEY = "gunsmoke_state_v" + String(V10_SAVE_VERSION);
var V10_LOCAL_STATE = "gunsmoke_localstate_v" + String(V10_SAVE_VERSION);
var SAVED_STATES_KEY = "gunsmoke_state_ids";
var CUSTOM_MAP_SLOTS_KEY = "gunsmoke_custom_maps";
var FAILED_STATE_BACKUP_KEY = "gunsmoke_failed_state_backup";
var MIN_SCALE = 0.25;
var MAX_SCALE = 10;
var MAP_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: MAP_WIDTH * TILE_SIZE,
  maxY: MAP_HEIGHT * TILE_SIZE
};

// src/store/appState.ts
var skillOrder = [
  1 /* BasicAttack */,
  3 /* Skill1 */,
  4 /* Skill2 */,
  2 /* Ultimate */,
  5 /* Passive */,
  6 /* SkillA */,
  7 /* SkillB */,
  8 /* SkillC */,
  10 /* SkillE */,
  9 /* FixedKey */,
  11 /* SelfPassive */,
  13 /* EndTurn */,
  12 /* Move */
];
var notations = /* @__PURE__ */ new Map([
  [1 /* BasicAttack */, ["S1", "1", "BA"]],
  [3 /* Skill1 */, ["S2", "2", "S1"]],
  [4 /* Skill2 */, ["S3", "3", "S2"]],
  [2 /* Ultimate */, ["S4", "4", "ULT"]],
  [5 /* Passive */, ["S5", "5", "PSV"]],
  [6 /* SkillA */, ["S6", "6", "SA", "1"]],
  [7 /* SkillB */, ["S7", "7", "SB", "2"]],
  [13 /* EndTurn */, ["ET", "Z", "END"]],
  [12 /* Move */, ["MV", "W", "MOVE", "MOV"]],
  [8 /* SkillC */, []],
  [10 /* SkillE */, []],
  [9 /* FixedKey */, []],
  [11 /* SelfPassive */, []]
]);
var notationSlots = new Map([...notations.keys()].map((type, slot) => [type, slot]));
function getNotationSlot(type) {
  const slot = notationSlots.get(type);
  if (slot === void 0) throw new Error(`No notation slot for skill type ${SkillTypeLabels[type]}`);
  return slot;
}
function getNotations(type) {
  const styles = notations.get(type);
  if (!styles) throw new Error(`No notations for skill type ${SkillTypeLabels[type]}`);
  return styles;
}
var endTurnSkill = {
  id: V9_END_TURN_SKILL_ID,
  name: SkillTypeLabels[13 /* EndTurn */],
  type: 13 /* EndTurn */,
  damage: [],
  selects: [],
  affects: [],
  range: "",
  // not a game-data skill; matches how the data describes skills that only affect their user
  shape: "Target",
  mode: 1 /* SingleTarget */,
  tags: [],
  icon: "vectors/end.svg"
};
function nextSummonInstanceId(tabs, taken = []) {
  const used = /* @__PURE__ */ new Set([...tabs.flatMap((tab) => tab.summonPositions.map((p) => p.mapId)), ...taken]);
  let n = 0;
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}
function makeDefaultTabData() {
  return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}
var [tempSelectedDolls, setTempSelectedDolls] = createStore([]);
var defaultState = {
  version: 9,
  selectedDolls: [],
  score: 0,
  description: "",
  map: "Broken-Horn Beasteel",
  buffs: [],
  tabData: Array.from({ length: 8 }, () => makeDefaultTabData())
};
var [state, setState] = createStore(structuredClone(defaultState));
var defaultLocalState = {
  alwaysDisplaySkills: true,
  currentTab: 0,
  skillDisplay: new Array(notations.size).fill(0),
  exportIncludeDolls: false,
  exportDiscord: false,
  exportAsLink: false,
  exportIncludeSeason: false,
  exportIncludeBoss: false
};
var [localState, setLocalState] = createStore(structuredClone(defaultLocalState));

// src/store/fortification.ts
var FORTIFICATION_KEYS = [1, 2, 3, 4, 5, 6];
function isUnknownArray(value) {
  return Array.isArray(value);
}
function applyOverride(merged, override, additiveKeys) {
  for (const [prop, value] of Object.entries(override)) {
    if (value === void 0) continue;
    const existing = merged[prop];
    merged[prop] = additiveKeys.includes(prop) && isUnknownArray(existing) && isUnknownArray(value) ? [...existing, ...value] : value;
  }
}
function mergeLevels(entry, fortification, keys, additiveKeys = []) {
  const { levels, replacedBy, ...base } = entry;
  const layers = [{ ...base, levels }];
  if (replacedBy) {
    for (const key of keys) {
      if (!key) continue;
      const replacement = replacedBy[key];
      if (replacement) layers.push(replacement);
    }
  }
  const merged = {};
  for (const [index, layer] of layers.entries()) {
    const { levels: layerLevels, ...props } = layer;
    if (index === 0) Object.assign(merged, props);
    else applyOverride(merged, props, []);
    if (!layerLevels) continue;
    for (const key of FORTIFICATION_KEYS) {
      if (key > fortification) break;
      const override = layerLevels[key];
      if (override) applyOverride(merged, override, additiveKeys);
    }
  }
  return merged;
}
function resolveSkill(skill, fortification, keys) {
  return mergeLevels(skill, fortification, keys);
}
function resolveSummon(summon, fortification, keys, includeLocked) {
  const merged = mergeLevels(summon, fortification, keys, ["skills"]);
  const skills = [...merged.skills];
  if (includeLocked) {
    for (const level of FORTIFICATION_KEYS) {
      if (level <= fortification) continue;
      for (const skill of summon.levels?.[level]?.skills ?? []) {
        if (!skills.some((s) => s.id === skill.id)) skills.push(skill);
      }
    }
  }
  return {
    ...merged,
    skills: skills.filter((skill) => includeLocked || filterSkill(skill, keys)).map((skill) => resolveSkill(skill, fortification, keys))
  };
}
function filterSkill(skill, keys) {
  if (skill.requiresKey) {
    if (keys.includes(skill.requiresKey)) {
      return true;
    } else {
      return false;
    }
  }
  return true;
}
function applyDollFortification(selectedDoll3, includeLocked = false) {
  const doll = combinedDolls.data[selectedDoll3.id];
  if (!doll) throw new Error(`Doll ${selectedDoll3.id} not found`);
  const { fortification, keys } = selectedDoll3;
  return {
    ...doll,
    skills: doll.skills.filter((s) => includeLocked || filterSkill(s, keys)).map((skill) => resolveSkill(skill, fortification, keys)),
    summons: doll.summons.map((summon) => resolveSummon(summon, fortification, keys, includeLocked))
  };
}

// src/log.ts
var chain = [];
function logScope(label, context = {}) {
  const scope = {
    label,
    context: { ...context },
    add(keyOrContext, value) {
      if (typeof keyOrContext === "string") {
        scope.context[keyOrContext] = value;
      } else {
        Object.assign(scope.context, keyOrContext);
      }
      return scope;
    },
    [Symbol.dispose]() {
      const index = chain.lastIndexOf(scope);
      if (index !== -1) chain.splice(index);
    }
  };
  chain.push(scope);
  return scope;
}
function currentChain() {
  const labels = [];
  const context = {};
  for (const scope of chain) {
    labels.push(scope.label);
    Object.assign(context, scope.context);
  }
  return { labels, context };
}
function write(level, message, args) {
  const { labels, context } = currentChain();
  const prefix = labels.length ? `[${labels.join(" > ")}] ` : "";
  const extra = Object.keys(context).length ? [context] : [];
  console[level](prefix + message, ...args, ...extra);
}
var log = {
  debug: (message, ...args) => {
    write("debug", message, args);
  },
  info: (message, ...args) => {
    write("info", message, args);
  },
  warn: (message, ...args) => {
    write("warn", message, args);
  },
  error: (message, ...args) => {
    write("error", message, args);
  }
};

// src/components/icons/Immobile.tsx
var _tmpl$8 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 77 77"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><path d="M38.5,6C56.437,6 71,20.563 71,38.5C71,56.437 56.437,71 38.5,71C20.563,71 6,56.437 6,38.5C6,20.563 20.563,6 38.5,6ZM38.5,14C24.978,14 14,24.978 14,38.5C14,52.022 24.978,63 38.5,63C52.022,63 63,52.022 63,38.5C63,24.978 52.022,14 38.5,14Z"style=fill:rgb(174,71,73)></path><g><g transform=matrix(1.19048,0,0,0.809524,5.16667,0.571429)><path d=M28,3L38.5,24L17.5,24L28,3Z style=fill:rgb(235,235,235)></path></g><g transform=matrix(1.19048,0,0,-0.809524,5.16667,76.4286)><path d=M28,3L38.5,24L17.5,24L28,3Z style=fill:rgb(235,235,235)></path></g><g transform=matrix(7.28956e-17,-1.19048,-0.809524,-4.9569e-17,76.4286,71.8333)><path d=M28,3L38.5,24L17.5,24L28,3Z style=fill:rgb(235,235,235)></path></g><g transform=matrix(-7.28956e-17,-1.19048,0.809524,-4.9569e-17,0.571429,71.8333)><path d=M28,3L38.5,24L17.5,24L28,3Z style=fill:rgb(235,235,235)></path></g><g transform=matrix(1,0,0,1.14286,0,-5.5)><path d=M34,42L18,42L18,35L34,35L34,21L42,21L42,35L58,35L58,42L42,42L42,56L34,56L34,42Z style=fill:rgb(235,235,235)></path></g></g><g transform=matrix(0.707107,0.707107,-0.707107,0.707107,38.5,-15.9472)><rect x=34 y=10 width=9 height=57 style=fill:rgb(174,71,73)>`);
function Immobile() {
  return _tmpl$8();
}

// src/store/images.ts
var IMAGE_TIMEOUT_MS = 1e4;
var entityIdToImage = /* @__PURE__ */ new Map();
var [imagesLoaded, setImagesLoaded] = createSignal(0);
var imageLoads = /* @__PURE__ */ new Map();
function attachImageToDoll(dollInfo) {
  const src = "icons" in dollInfo ? dollInfo.icons.avatar : dollInfo.icon;
  const existing = imageLoads.get(dollInfo.id);
  if (existing?.src === src) return existing.done;
  const img = new Image();
  const done = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      log.warn(`Image for ${dollInfo.id} is still loading after ${IMAGE_TIMEOUT_MS / 1e3}s; continuing without it`, src);
      resolve();
    }, IMAGE_TIMEOUT_MS);
    img.onload = () => {
      clearTimeout(timeout);
      setImagesLoaded((count) => count + 1);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timeout);
      log.warn(`Failed to load image for ${dollInfo.id}`, src);
      resolve();
    };
  });
  img.src = src;
  entityIdToImage.set(dollInfo.id, img);
  imageLoads.set(dollInfo.id, { src, done });
  return done;
}
async function preloadCanvasImages() {
  const entries = [];
  const selectedDolls = state.selectedDolls;
  for (const selectedDoll3 of selectedDolls) {
    const doll = getSelectedDoll(selectedDoll3);
    entries.push(attachImageToDoll(doll));
    for (const summon of doll.summons) {
      entries.push(attachImageToDoll(summon));
    }
  }
  await Promise.all(entries);
}
var immobileIcon;
function getImmobileIcon() {
  if (!immobileIcon) {
    const svg = Immobile();
    svg.setAttribute("width", "154");
    svg.setAttribute("height", "154");
    immobileIcon = new Image();
    immobileIcon.onload = () => setImagesLoaded((count) => count + 1);
    immobileIcon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`;
  }
  return immobileIcon.complete && immobileIcon.naturalWidth > 0 ? immobileIcon : void 0;
}
var PREFETCH_CONCURRENCY = 4;
var prefetchedImages = [];
function prefetchModalImages() {
  const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 0));
  idle(() => {
    const dolls = Object.values(combinedDolls.data);
    const srcs = /* @__PURE__ */ new Set([
      ...dolls.map((doll) => doll.icons.avatar),
      ...Object.values(combinedKeys.data).map((key) => key.icon),
      ...dolls.map((doll) => doll.icons.chibi),
      ...Object.values(combinedWeapons.data).map((weapon) => weapon.icon)
    ]);
    srcs.delete("");
    const queue = [...srcs];
    const next = () => {
      const src = queue.shift();
      if (src === void 0) return;
      const img = new Image();
      img.fetchPriority = "low";
      img.onload = img.onerror = next;
      img.src = src;
      prefetchedImages.push(img);
    };
    for (let i = 0; i < PREFETCH_CONCURRENCY; i++) next();
  });
}
function getImageForEntity(entityId) {
  const image = entityIdToImage.get(entityId);
  return image?.complete && image.naturalWidth > 0 ? image : void 0;
}

// src/store/dollSelection.ts
function setupTempSelectedDolls() {
  setTempSelectedDolls(
    produce((selectedDolls) => {
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
function openFormation() {
  setupTempSelectedDolls();
  setDollFortification(Object.fromEntries(state.selectedDolls.map((d) => [d.id, d.fortification])));
  setShowFormationModal(true);
}
function openDollKeys(dollId, need) {
  openFormation();
  const doll = tempSelectedDolls.find((d) => d.id === dollId);
  if (!doll) return;
  setKeyFocus(need ? { dollId, ...need } : null);
  setSelectedDoll(doll);
  setShowKeyModal(true);
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
function defaultLoadout(dollId) {
  return {
    id: dollId,
    fortification: 0,
    keys: Array(8).fill(""),
    remoldingLvl: REMOLDING_LEVELS[0],
    gun: getWeaponByDollId(dollId).id,
    borrow: false
  };
}
function addDollToTempSelect(dollId) {
  setTempSelectedDolls(
    produce((selectedDolls) => {
      selectedDolls.push(defaultLoadout(dollId));
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
function setDollKeys(dollId, keys) {
  if (!dollId) return;
  setTempSelectedDolls(
    produce((selectedDolls) => {
      for (const doll of selectedDolls) {
        if (doll.id === dollId) {
          doll.keys.length = 0;
          doll.keys.push(...keys);
        }
      }
    })
  );
}
function changeFortification(dollId, fort) {
  setTempSelectedDolls(
    produce((tempSelected) => {
      const index = tempSelected.findIndex((d) => d.id === dollId);
      if (index !== -1) {
        const lowest = FORTIFICATION_LEVELS[0];
        const highest = FORTIFICATION_LEVELS[FORTIFICATION_LEVELS.length - 1];
        tempSelected[index].fortification = Math.min(highest, Math.max(lowest, tempSelected[index].fortification + fort));
      }
    })
  );
}
function changeBorrow(dollId) {
  setTempSelectedDolls(
    produce((tempSelected) => {
      for (const doll of tempSelected) {
        doll.borrow = false;
        if (doll.id === dollId) {
          doll.borrow = !doll.borrow;
        }
      }
    })
  );
}
function changeRemoldingLvl(dollId, modifier) {
  const remoldingLevels = REMOLDING_LEVELS;
  setTempSelectedDolls(
    produce((tempSelected) => {
      const index = tempSelected.findIndex((d) => d.id === dollId);
      if (index !== -1) {
        let currentLvl = remoldingLevels.indexOf(tempSelected[index].remoldingLvl);
        currentLvl += modifier;
        currentLvl = Math.max(0, currentLvl);
        currentLvl = Math.min(remoldingLevels.length - 1, currentLvl);
        tempSelected[index].remoldingLvl = remoldingLevels[currentLvl];
      }
    })
  );
}
function saveDollLoadout(dollId) {
  const index = tempSelectedDolls.findIndex((d) => d.id === dollId);
  if (index !== -1) {
    const doll = tempSelectedDolls[index];
    localStorage.setItem(V9_DOLL_LOADOUT_KEY(dollId), JSON.stringify(doll));
  }
}
function loadDollLoadout(dollId) {
  const loadout = localStorageLoad(V9_DOLL_LOADOUT_KEY(dollId));
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
  return localStorage.getItem(V9_DOLL_LOADOUT_KEY(dollId)) !== null;
}
function defaultActionOrder(tabIndex) {
  if (tabIndex < 0 || tabIndex > 7) return;
  const oldOrder = state.tabData[tabIndex].actionOrder ?? [];
  const order = new Set(oldOrder);
  const unique = /* @__PURE__ */ new Set();
  setState(
    produce((s) => {
      for (const doll of s.selectedDolls) {
        order.add(doll.id);
        unique.add(doll.id);
        const dollInfo = getSelectedDoll(doll);
        for (const summon of dollInfo.summons) {
          order.add(summon.id);
          unique.add(summon.id);
        }
      }
      for (const dollId of order) {
        if (!unique.has(dollId)) {
          order.delete(dollId);
        }
      }
      s.tabData[tabIndex].actionOrder = Array.from(order);
    })
  );
}
function currentIdsByBase(dolls) {
  const ids = /* @__PURE__ */ new Map();
  for (const doll of dolls) {
    ids.set(doll.id, doll.id);
    for (const summon of getSelectedDoll(doll).summons) ids.set(summonBaseIdOf(summon.id), summon.id);
  }
  return ids;
}
function changeSelectedDolls(newDolls) {
  setState(
    produce((s) => {
      applySelectedDolls(s, newDolls);
    })
  );
}
function applySelectedDolls(timeline, newDolls) {
  var _a;
  const oldIds = currentIdsByBase(timeline.selectedDolls);
  const newIds = currentIdsByBase(newDolls);
  const removed = [...oldIds].filter(([base]) => !newIds.has(base)).map(([, id]) => id);
  const added = [...newIds].filter(([base]) => !oldIds.has(base)).map(([, id]) => id);
  const renamed = /* @__PURE__ */ new Map();
  for (const [base, oldId] of oldIds) {
    const newId = newIds.get(base);
    if (newId !== void 0 && newId !== oldId) renamed.set(oldId, newId);
  }
  const rename = (id) => renamed.get(id) ?? id;
  const entitiesOf = (dolls) => {
    const entities = /* @__PURE__ */ new Map();
    for (const doll of dolls) {
      const resolved = getSelectedDoll(doll, true);
      entities.set(doll.id, resolved);
      for (const summon of resolved.summons) entities.set(summon.id, summon);
    }
    return entities;
  };
  const oldEntities = entitiesOf(timeline.selectedDolls);
  const newEntities = entitiesOf(newDolls);
  const isCurrent = (skillId, owner) => !!owner && hasSkillFamily(skillId, owner) && resolveSkill2(skillId, owner).id === skillId;
  const resolveAction = (oldOwnerId, ownerId, [skillId, targetId]) => {
    const owner = newEntities.get(ownerId);
    const skill = skillId !== V9_END_TURN_SKILL_ID && isCurrent(skillId, oldEntities.get(oldOwnerId)) && owner && hasSkillFamily(skillId, owner) ? resolveSkill2(skillId, owner).id : skillId;
    return targetId === void 0 ? [skill] : [skill, rename(targetId)];
  };
  timeline.selectedDolls.length = 0;
  timeline.selectedDolls.push(...newDolls);
  for (let tabIndex = 0; tabIndex < 8; tabIndex++) {
    const tab = timeline.tabData[tabIndex];
    for (const dollId of removed) {
      if (dollId in tab.dollPositions && hasPrefix(dollId, "d" /* Dolls */)) {
        delete tab.dollPositions[dollId];
      }
      delete tab.actions[dollId];
      const orderIndex = tab.actionOrder.indexOf(dollId);
      if (orderIndex !== -1) tab.actionOrder.splice(orderIndex, 1);
      tab.summonPositions = tab.summonPositions.filter((p) => p.id !== dollId);
    }
    tab.actionOrder = tab.actionOrder.map(rename);
    tab.summonPositions = tab.summonPositions.map((p) => ({ ...p, id: rename(p.id) }));
    tab.actions = Object.fromEntries(
      Object.entries(tab.actions).map(([ownerKey, actions]) => {
        const oldOwnerId = ownerKey;
        const ownerId = rename(oldOwnerId);
        return [ownerId, actions.map((action) => resolveAction(oldOwnerId, ownerId, action))];
      })
    );
    for (const dollId of added) {
      if (hasPrefix(dollId, "d" /* Dolls */)) {
        tab.dollPositions[dollId] = { x: -1, y: -1 };
      }
      (_a = tab.actions)[dollId] ?? (_a[dollId] = []);
      if (!tab.actionOrder.includes(dollId)) tab.actionOrder.push(dollId);
    }
  }
  if (added.length || removed.length) {
    timeline.score = 0;
    timeline.description = "";
  }
  return { added, removed, renamed: Object.fromEntries(renamed) };
}
async function updateSelectedDolls() {
  changeSelectedDolls([...tempSelectedDolls]);
  await preloadCanvasImages();
  for (let i = 0; i < 8; i++) defaultActionOrder(i);
  saveToLocalStorage();
}

// gfl2-data/id-mapping.json
var id_mapping_default = {
  dolls: {
    d1: "d1b",
    d2: "dp",
    d3: "d17",
    d4: "d1h",
    d5: "ds",
    d6: "dd",
    d7: "d9",
    d8: "d1g",
    d9: "d2",
    d10: "df",
    d11: "d8",
    d60: "d34",
    d12: "dq",
    d13: "d1a",
    d14: "d5",
    d15: "dv",
    d16: "d1d",
    d17: "di",
    d18: "dy",
    d19: "d0",
    d20: "dj",
    d21: "d14",
    d22: "d3",
    d23: "d12",
    d24: "d18",
    d25: "d15",
    d26: "dl",
    d27: "d1i",
    d28: "d1f",
    d29: "do",
    d30: "dh",
    d31: "dx",
    d59: "d1n",
    d32: "dg",
    d33: "db",
    d34: "d1",
    d58: "d1l",
    d35: "d11",
    d56: "d1k",
    d36: "dn",
    d37: "dz",
    d38: "d6",
    d39: "d16",
    d40: "dc",
    d41: "du",
    d42: "d13",
    d43: "de",
    d44: "d1e",
    d45: "d1j",
    d46: "d7",
    d57: "d1m",
    d47: "dt",
    d48: "dm",
    d49: "da",
    d50: "dk",
    d51: "dr",
    d52: "d4",
    d53: "d1c",
    d54: "d10",
    d55: "dw"
  },
  summons: {
    s1: "md",
    s2: "mk",
    s3: "ml",
    s4: "mq",
    s5: "m18",
    s6: "mz",
    s7: "mh",
    s8: "m7",
    s9: "m11",
    s10: "m12",
    s11: "m12",
    s12: "mw",
    s13: "mg"
  },
  skills: {
    d1: {
      "1": "sx7",
      "2": "sxc",
      "3": "sx9",
      "4": "sxa",
      "5": "sx8"
    },
    d2: {
      "1": "sk3",
      "2": "sk7",
      "3": "sk5",
      "4": "sk6",
      "5": "sk4"
    },
    d3: {
      "1": "sun",
      "2": "sur",
      "3": "sup",
      "4": "suq",
      "5": "suo"
    },
    d4: {
      "1": "s10c",
      "2": "s10g",
      "3": "s10e",
      "4": "s10f",
      "5": "s10d"
    },
    d5: {
      "1": "slx",
      "2": "sm1",
      "3": "slz",
      "4": "sm0",
      "5": "sly"
    },
    d6: {
      "1": "sd4",
      "2": "sd8",
      "3": "sd5",
      "4": "sd6",
      "5": "sd7"
    },
    d7: {
      "1": "sb0",
      "2": "sb4",
      "3": "sb2",
      "4": "sb3",
      "5": "sb1"
    },
    d8: {
      "1": "szu",
      "2": "szy",
      "3": "szw",
      "4": "szx",
      "5": "szv"
    },
    d9: {
      "1": "s78",
      "2": "s7c",
      "3": "s7a",
      "4": "s7b",
      "5": "s79"
    },
    d10: {
      "1": "se7",
      "2": "seb",
      "3": "se9",
      "4": "sea",
      "5": "se8"
    },
    d11: {
      "1": "sah",
      "2": "sal",
      "3": "saj",
      "4": "sak",
      "5": "sai"
    },
    d60: {
      "1": "s18t",
      "2": "s18x",
      "3": "s18v",
      "4": "s18w",
      "5": "s18u",
      "6": "s18y",
      "7": "s18z",
      "8": "s190"
    },
    d12: {
      "1": "skv",
      "2": "skz",
      "3": "skx",
      "4": "sky",
      "5": "skw"
    },
    d13: {
      "1": "swj",
      "2": "swn",
      "3": "swl",
      "4": "swm",
      "5": "swk"
    },
    d14: {
      "1": "s8u",
      "2": "s8y",
      "3": "s8w",
      "4": "s8x",
      "5": "s8v"
    },
    d15: {
      "1": "snl",
      "2": "snp",
      "3": "snn",
      "4": "sno",
      "5": "snm"
    },
    d16: {
      "1": "sy9",
      "2": "syd",
      "3": "syb",
      "4": "syc",
      "5": "sya"
    },
    d17: {
      "1": "sft",
      "2": "sfx",
      "3": "sfv",
      "4": "sfw",
      "5": "sfu"
    },
    d18: {
      "1": "sp7",
      "2": "spb",
      "3": "sp9",
      "4": "spa",
      "5": "sp8"
    },
    d19: {
      "1": "s66",
      "2": "s6a",
      "3": "s68",
      "4": "s69",
      "5": "s67"
    },
    d20: {
      "1": "sgc",
      "2": "sgg",
      "3": "sge",
      "4": "sgf",
      "5": "sgd"
    },
    d21: {
      "1": "ssn",
      "2": "ssy",
      "3": "sso",
      "4": "ssp",
      "5": "ssq"
    },
    d22: {
      "1": "s7r",
      "2": "s7w",
      "3": "s7t",
      "4": "s7u",
      "5": "s7s"
    },
    d23: {
      "1": "srj",
      "2": "srn",
      "3": "srl",
      "4": "srm",
      "5": "srk",
      "6": "sro"
    },
    d24: {
      "1": "svi",
      "2": "svm",
      "3": "svk",
      "4": "svl",
      "5": "svj"
    },
    d25: {
      "1": "stl",
      "2": "stp",
      "3": "stn",
      "4": "sto",
      "5": "stm",
      "6": "stq"
    },
    d26: {
      "1": "shf",
      "2": "shj",
      "3": "shh",
      "4": "shi",
      "5": "shg"
    },
    d27: {
      "1": "s10u",
      "2": "s10y",
      "3": "s10w",
      "4": "s10x",
      "5": "s10v"
    },
    d28: {
      "1": "sza",
      "2": "sze",
      "3": "szc",
      "4": "szd",
      "5": "szb"
    },
    d29: {
      "1": "sjk",
      "2": "sjo",
      "3": "sjm",
      "4": "sjn",
      "5": "sjl"
    },
    d30: {
      "1": "sf9",
      "2": "sfe",
      "3": "sfc",
      "4": "sfd",
      "5": "sfa"
    },
    d31: {
      "1": "son",
      "2": "sor",
      "3": "sop",
      "4": "soq",
      "5": "soo",
      "6": "sos"
    },
    d59: {
      "1": "s144",
      "2": "s14d",
      "3": "s146",
      "4": "s14c",
      "5": "s145"
    },
    d32: {
      "1": "seq",
      "2": "seu",
      "3": "ses",
      "4": "set",
      "5": "ser"
    },
    d33: {
      "1": "sc2",
      "2": "sc6",
      "3": "sc4",
      "4": "sc5",
      "5": "sc3"
    },
    d34: {
      "1": "s6p",
      "2": "s6t",
      "3": "s6r",
      "4": "s6s",
      "5": "s6q"
    },
    d58: {
      "1": "s12v",
      "2": "s12z",
      "3": "s12x",
      "4": "s12y",
      "5": "s12w"
    },
    d35: {
      "1": "sqw",
      "2": "sr0",
      "3": "sqy",
      "4": "sqz",
      "5": "sqx"
    },
    d56: {
      "1": "s11y",
      "2": "s123",
      "3": "s122",
      "4": "s120",
      "5": "s121",
      "6": "s11z"
    },
    d36: {
      "1": "sih",
      "2": "sil",
      "3": "sij",
      "4": "sik",
      "5": "sii"
    },
    d37: {
      "1": "spq",
      "2": "spu",
      "3": "sps",
      "4": "spt",
      "5": "spr"
    },
    d38: {
      "1": "s9d",
      "2": "s9j",
      "3": "s9e",
      "4": "s9f",
      "5": "s9i"
    },
    d39: {
      "1": "su4",
      "2": "su8",
      "3": "su6",
      "4": "su7",
      "5": "su5"
    },
    d40: {
      "1": "scl",
      "2": "scp",
      "3": "scn",
      "4": "sco",
      "5": "scm"
    },
    d41: {
      "1": "sn3",
      "2": "sn7",
      "3": "sn5",
      "4": "sn6",
      "5": "sn4"
    },
    d42: {
      "1": "ss4",
      "2": "ss8",
      "3": "ss6",
      "4": "ss7",
      "5": "ss5"
    },
    d43: {
      "1": "sdn",
      "2": "sdr",
      "3": "sdp",
      "4": "sdq",
      "5": "sdo"
    },
    d44: {
      "1": "syr",
      "2": "syv",
      "3": "syt",
      "4": "syu",
      "5": "sys"
    },
    d45: {
      "1": "s11g",
      "2": "s11k",
      "3": "s11i",
      "4": "s11j",
      "5": "s11h"
    },
    d46: {
      "1": "s9y",
      "2": "sa2",
      "3": "sa0",
      "4": "sa1",
      "5": "s9z"
    },
    d57: {
      "1": "s13d",
      "2": "s13h",
      "3": "s13f",
      "4": "s13j",
      "5": "s13g",
      "6": "s13k",
      "7": "s13e"
    },
    d47: {
      "1": "smk",
      "2": "smo",
      "3": "smm",
      "4": "smn",
      "5": "sml"
    },
    d48: {
      "1": "shy",
      "2": "si2",
      "3": "si0",
      "4": "si1",
      "5": "shz"
    },
    d49: {
      "1": "sbj",
      "2": "sbn",
      "3": "sbl",
      "4": "sbm",
      "5": "sbk"
    },
    d50: {
      "1": "sgw",
      "2": "sh0",
      "3": "sgy",
      "4": "sgz",
      "5": "sgx"
    },
    d51: {
      "1": "sle",
      "2": "sli",
      "3": "slg",
      "4": "slh",
      "5": "slf"
    },
    d52: {
      "1": "s8b",
      "2": "s8f",
      "3": "s8c",
      "4": "s8d",
      "5": "s8e"
    },
    d53: {
      "1": "sxr",
      "2": "sxv",
      "3": "sxt",
      "4": "sxu",
      "5": "sxs"
    },
    d54: {
      "1": "sq9",
      "2": "sqd",
      "3": "sqb",
      "4": "sqc",
      "5": "sqa",
      "6": "sqe",
      "7": "sqf"
    },
    d55: {
      "1": "so4",
      "2": "so8",
      "3": "so6",
      "4": "so7",
      "5": "so5"
    },
    s1: {
      "1": "sk8",
      "2": "sk9",
      "3": "ska",
      "4": "skg"
    },
    s2: {
      "1": "sus",
      "2": "sut"
    },
    s3: {
      "1": "suw",
      "2": "sv0"
    },
    s4: {
      "1": "swo",
      "2": "swp"
    },
    s5: {
      "1": "ssr",
      "2": "sss",
      "3": "sst",
      "4": "ssu",
      "5": "ssz"
    },
    s6: {
      "1": "s10z",
      "2": "s110"
    },
    s7: {
      "1": "sr1",
      "2": "sr9"
    },
    s8: {
      "1": "sim",
      "2": "sip",
      "3": "sj9"
    },
    s10: {
      "1": "s147",
      "2": "s148"
    },
    s13: {
      "1": "smg"
    }
  },
  keys: {
    d1: {
      k1: "f99",
      k2: "f93",
      k3: "f94",
      k4: "f95",
      k5: "f96",
      k6: "f97",
      k7: "f98",
      a1: "a1b",
      c1: "c1b"
    },
    d2: {
      k1: "f53",
      k2: "f4x",
      k3: "f4y",
      k4: "f4z",
      k5: "f50",
      k6: "f51",
      k7: "f52",
      a2: "ap",
      c2: "cp"
    },
    d3: {
      k1: "f8d",
      k2: "f8e",
      k3: "f8f",
      k4: "f8g",
      k5: "f8h",
      k6: "f8i",
      a3: "a17",
      c3: "c17"
    },
    d4: {
      k1: "fa4",
      k2: "fa5",
      k3: "fa6",
      k4: "fa7",
      k5: "fa8",
      k6: "fa9",
      a4: "a1h",
      c4: "c1h"
    },
    d5: {
      k1: "f5o",
      k2: "f5i",
      k3: "f5j",
      k4: "f5k",
      k5: "f5l",
      k6: "f5m",
      k7: "f5n",
      a5: "as",
      c5: "cs"
    },
    d6: {
      k1: "f2p",
      k2: "f2j",
      k3: "f2k",
      k4: "f2l",
      k5: "f2m",
      k6: "f2n",
      k7: "f2o",
      a6: "ad",
      c6: "cd"
    },
    d7: {
      k1: "f1x",
      k2: "f1r",
      k3: "f1s",
      k4: "f1t",
      k5: "f1u",
      k6: "f1v",
      k7: "f1w",
      a7: "a9",
      c7: "c9"
    },
    d8: {
      k1: "f9y",
      k2: "f9z",
      k3: "fa0",
      k4: "fa1",
      k5: "fa2",
      k6: "fa3",
      a8: "a1g",
      c8: "c1g"
    },
    d9: {
      k1: "fk",
      k2: "fe",
      k3: "ff",
      k4: "fg",
      k5: "fh",
      k6: "fi",
      k7: "fj",
      a9: "a2",
      c9: "c2"
    },
    d10: {
      k1: "f33",
      k2: "f34",
      k3: "f2x",
      k4: "f2y",
      k5: "f2z",
      k6: "f30",
      k7: "f31",
      k8: "f32",
      a10: "af",
      c10: "cf"
    },
    d11: {
      k1: "f1q",
      k2: "f1k",
      k3: "f1l",
      k4: "f1m",
      k5: "f1n",
      k6: "f1o",
      k7: "f1p",
      a11: "a8",
      c11: "c8"
    },
    d60: {
      k1: "fbd",
      k2: "fbe",
      k3: "fbf",
      k4: "fbg",
      k5: "fbh",
      k6: "fbi",
      a60: "a1n",
      c60: "c1o"
    },
    d12: {
      k1: "f5a",
      k2: "f54",
      k3: "f55",
      k4: "f56",
      k5: "f57",
      k6: "f58",
      k7: "f59",
      a12: "aq",
      c12: "cq"
    },
    d13: {
      k1: "f92",
      k2: "f8w",
      k3: "f8x",
      k4: "f8y",
      k5: "f8z",
      k6: "f90",
      k7: "f91",
      a13: "a1a",
      c13: "c1a"
    },
    d14: {
      k1: "f15",
      k2: "fz",
      k3: "f10",
      k4: "f11",
      k5: "f12",
      k6: "f13",
      k7: "f14",
      a14: "a5",
      c14: "c5"
    },
    d15: {
      k1: "f63",
      k2: "f64",
      k3: "f65",
      k4: "f66",
      k5: "f67",
      k6: "f68",
      a15: "av",
      c15: "cv"
    },
    d16: {
      k1: "f9g",
      k2: "f9h",
      k3: "f9i",
      k4: "f9j",
      k5: "f9k",
      k6: "f9l",
      a16: "a1d",
      c16: "c1d"
    },
    d17: {
      k1: "f3p",
      k2: "f3j",
      k3: "f3k",
      k4: "f3l",
      k5: "f3m",
      k6: "f3n",
      k7: "f3o",
      a17: "ai",
      c17: "ci"
    },
    d18: {
      k1: "f6t",
      k2: "f6n",
      k3: "f6o",
      k4: "f6p",
      k5: "f6q",
      k6: "f6r",
      k7: "f6s",
      a18: "ay",
      c18: "cy"
    },
    d19: {
      k1: "f6",
      k2: "f0",
      k3: "f1",
      k4: "f2",
      k5: "f3",
      k6: "f4",
      k7: "f5",
      a19: "a0",
      c19: "c0"
    },
    d20: {
      k1: "f3w",
      k2: "f3q",
      k3: "f3r",
      k4: "f3s",
      k5: "f3t",
      k6: "f3u",
      k7: "f3v",
      a20: "aj",
      c20: "cj"
    },
    d21: {
      k1: "f7z",
      k2: "f7t",
      k3: "f7u",
      k4: "f7v",
      k5: "f7w",
      k6: "f7x",
      k7: "f7y",
      a21: "a14",
      c21: "c14"
    },
    d22: {
      k1: "fr",
      k2: "fl",
      k3: "fm",
      k4: "fn",
      k5: "fo",
      k6: "fp",
      k7: "fq",
      a22: "a3",
      c22: "c3"
    },
    d23: {
      k1: "f7l",
      k2: "f7f",
      k3: "f7g",
      k4: "f7h",
      k5: "f7i",
      k6: "f7j",
      k7: "f7k",
      a23: "a12",
      c23: "c12"
    },
    d24: {
      k1: "f8k",
      k2: "f8l",
      k3: "f8m",
      k4: "f8n",
      k5: "f8o",
      k6: "f8p",
      a24: "a18",
      c24: "c18"
    },
    d25: {
      k1: "f80",
      k2: "f81",
      k3: "f82",
      k4: "f83",
      k5: "f84",
      k6: "f85",
      a25: "a15",
      c25: "c15"
    },
    d26: {
      k1: "f4b",
      k2: "f45",
      k3: "f46",
      k4: "f47",
      k5: "f48",
      k6: "f49",
      k7: "f4a",
      a26: "al",
      c26: "cl"
    },
    d27: {
      k1: "faa",
      k2: "fab",
      k3: "fac",
      k4: "fad",
      k5: "fae",
      k6: "faf",
      a27: "a1i",
      c27: "c1i"
    },
    d28: {
      k1: "f9s",
      k2: "f9t",
      k3: "f9u",
      k4: "f9v",
      k5: "f9w",
      k6: "f9x",
      a28: "a1f",
      c28: "c1f"
    },
    d29: {
      k1: "f4w",
      k2: "f4q",
      k3: "f4r",
      k4: "f4s",
      k5: "f4t",
      k6: "f4u",
      k7: "f4v",
      a29: "ao",
      c29: "co"
    },
    d30: {
      k1: "f3i",
      k2: "f3c",
      k3: "f3d",
      k4: "f3e",
      k5: "f3f",
      k6: "f3g",
      k7: "f3h",
      a30: "ah",
      c30: "ch"
    },
    d31: {
      k1: "f6m",
      k2: "f6g",
      k3: "f6h",
      k4: "f6i",
      k5: "f6j",
      k6: "f6k",
      k7: "f6l",
      a31: "ax",
      c31: "cx"
    },
    d59: {
      k1: "fb4",
      k2: "fb5",
      k3: "fb6",
      k4: "fb7",
      k5: "fb8",
      k6: "fb9",
      a59: "a1m",
      c59: "c1n"
    },
    d32: {
      k1: "f3b",
      k2: "f35",
      k3: "f36",
      k4: "f37",
      k5: "f38",
      k6: "f39",
      k7: "f3a",
      a32: "ag",
      c32: "cg"
    },
    d33: {
      k1: "f2b",
      k2: "f25",
      k3: "f26",
      k4: "f27",
      k5: "f28",
      k6: "f29",
      k7: "f2a",
      a33: "ab",
      c33: "cb"
    },
    d34: {
      k1: "fd",
      k2: "f7",
      k3: "f8",
      k4: "f9",
      k5: "fa",
      k6: "fb",
      k7: "fc",
      a34: "a1",
      c34: "c1"
    },
    d58: {
      k1: "fas",
      k2: "fat",
      k3: "fau",
      k4: "fav",
      k5: "faw",
      k6: "fax",
      c58: "c1l",
      a58: "a1"
    },
    d35: {
      k1: "f7e",
      k2: "f78",
      k3: "f79",
      k4: "f7a",
      k5: "f7b",
      k6: "f7c",
      k7: "f7d",
      a35: "a11",
      c35: "c11"
    },
    d56: {
      k1: "fam",
      k2: "fan",
      k3: "fao",
      k4: "fap",
      k5: "faq",
      k6: "far",
      a56: "a1k",
      c56: "c1k"
    },
    d36: {
      k1: "f4p",
      k2: "f4j",
      k3: "f4k",
      k4: "f4l",
      k5: "f4m",
      k6: "f4n",
      k7: "f4o",
      a36: "an",
      c36: "cn"
    },
    d37: {
      k1: "f70",
      k2: "f6u",
      k3: "f6v",
      k4: "f6w",
      k5: "f6x",
      k6: "f6y",
      k7: "f6z",
      a37: "az",
      c37: "cz"
    },
    d38: {
      k1: "f1c",
      k2: "f16",
      k3: "f17",
      k4: "f18",
      k5: "f19",
      k6: "f1a",
      k7: "f1b",
      a38: "a6",
      c38: "c6"
    },
    d39: {
      k1: "f88",
      k2: "f87",
      k3: "f89",
      k4: "f8a",
      k5: "f8b",
      k6: "f8c",
      a39: "a16",
      c39: "c16"
    },
    d40: {
      k1: "f2i",
      k2: "f2c",
      k3: "f2d",
      k4: "f2e",
      k5: "f2f",
      k6: "f2g",
      k7: "f2h",
      a40: "ac",
      c40: "cc"
    },
    d41: {
      k1: "f62",
      k2: "f5w",
      k3: "f5x",
      k4: "f5y",
      k5: "f5z",
      k6: "f60",
      k7: "f61",
      a41: "au",
      c41: "cu"
    },
    d42: {
      k1: "f7m",
      k2: "f7n",
      k3: "f7o",
      k4: "f7p",
      k5: "f7q",
      k6: "f7r",
      k7: "f7s",
      a42: "a13",
      c42: "c13"
    },
    d43: {
      k1: "f2w",
      k2: "f2q",
      k3: "f2r",
      k4: "f2s",
      k5: "f2t",
      k6: "f2u",
      k7: "f2v",
      a43: "ae",
      c43: "ce"
    },
    d44: {
      k1: "f9m",
      k2: "f9n",
      k3: "f9o",
      k4: "f9p",
      k5: "f9q",
      k6: "f9r",
      a44: "a1e",
      c44: "c1e"
    },
    d45: {
      k1: "fag",
      k2: "fah",
      k3: "fai",
      k4: "faj",
      k5: "fak",
      k6: "fal",
      a45: "a1j",
      c45: "c1j"
    },
    d46: {
      k1: "f1j",
      k2: "f1d",
      k3: "f1e",
      k4: "f1f",
      k5: "f1g",
      k6: "f1h",
      k7: "f1i",
      a46: "a7",
      c46: "c7"
    },
    d57: {
      k1: "fay",
      k2: "faz",
      k3: "fb0",
      k4: "fb1",
      k5: "fb2",
      k6: "fb3",
      a57: "a1l",
      c57: "c1m"
    },
    d47: {
      k1: "f5v",
      k2: "f5p",
      k3: "f5q",
      k4: "f5r",
      k5: "f5s",
      k6: "f5t",
      k7: "f5u",
      a47: "at",
      c47: "ct"
    },
    d48: {
      k1: "f4i",
      k2: "f4c",
      k3: "f4d",
      k4: "f4e",
      k5: "f4f",
      k6: "f4g",
      k7: "f4h",
      a48: "am",
      c48: "cm"
    },
    d49: {
      k1: "f24",
      k2: "f1y",
      k3: "f1z",
      k4: "f20",
      k5: "f21",
      k6: "f22",
      k7: "f23",
      a49: "aa",
      c49: "ca"
    },
    d50: {
      k1: "f43",
      k2: "f44",
      k3: "f3x",
      k4: "f3y",
      k5: "f3z",
      k6: "f40",
      k7: "f41",
      k8: "f42",
      a50: "ak",
      c50: "ck"
    },
    d51: {
      k1: "f5h",
      k2: "f5b",
      k3: "f5c",
      k4: "f5d",
      k5: "f5e",
      k6: "f5f",
      k7: "f5g",
      a51: "ar",
      c51: "cr"
    },
    d52: {
      k1: "fy",
      k2: "fs",
      k3: "ft",
      k4: "fu",
      k5: "fv",
      k6: "fw",
      k7: "fx",
      a52: "a4",
      c52: "c4"
    },
    d53: {
      k1: "f9a",
      k2: "f9b",
      k3: "f9c",
      k4: "f9d",
      k5: "f9e",
      k6: "f9f",
      a53: "a1c",
      c53: "c1c"
    },
    d54: {
      k1: "f77",
      k2: "f71",
      k3: "f72",
      k4: "f73",
      k5: "f74",
      k6: "f75",
      k7: "f76",
      a54: "a10",
      c54: "c10"
    },
    d55: {
      k1: "f6f",
      k2: "f69",
      k3: "f6a",
      k4: "f6b",
      k5: "f6c",
      k6: "f6d",
      k7: "f6e",
      a55: "aw",
      c55: "cw"
    }
  },
  weapons: {
    w1: "w2w",
    w2: "w2z",
    w3: "w12",
    w4: "w3n",
    w5: "w1q",
    w6: "w4i",
    w7: "w2",
    w8: "w4q",
    w9: "wk",
    w10: "w4t",
    w11: "w4d",
    w12: "w1t",
    w13: "w3r",
    w14: "w1z",
    w15: "w1b",
    w16: "w1w",
    w17: "w1k",
    w18: "w18",
    w19: "w3u",
    w20: "w0",
    w21: "w35",
    w22: "w1n",
    w23: "w8",
    w24: "w2b",
    w25: "w25",
    w26: "wx",
    w27: "wu",
    w28: "w28",
    w29: "w32",
    w30: "w5",
    w31: "w41",
    w32: "w4l",
    w33: "w2e",
    w34: "w1h",
    w35: "w4",
    w36: "w2k",
    w37: "w43",
    w38: "w2n",
    w39: "w1",
    w40: "wh",
    w41: "wb",
    w42: "w22",
    w43: "w3b",
    w44: "w1e",
    w45: "we",
    w46: "w3h",
    w47: "w3o",
    w48: "w38",
    w49: "w3e",
    w50: "w15",
    w51: "w2t",
    w52: "w4u",
    w53: "w2h",
    w54: "w3",
    w55: "wp",
    w56: "w3k",
    w57: "wi",
    w58: "w6",
    w59: "wy",
    w60: "w2i",
    w61: "w1c",
    w62: "w13",
    w63: "wn"
  },
  buffs: {
    b1: "bjq",
    b2: "bj9",
    b4: "bjy",
    b6: "bjm",
    b8: "bjj",
    b9: "bju",
    b11: "bkf",
    b12: "bjd",
    b13: "bkn",
    b14: "bkk",
    b15: "bk8",
    b16: "bjt",
    b18: "bj3",
    b19: "biy",
    b21: "bkc",
    b22: "bkj",
    b23: "bk4",
    b27: "bko",
    b28: "bki",
    b29: "bkh",
    b34: "bmh",
    b38: "bjz",
    b45: "bjb",
    b49: "bk9",
    b51: "bk5",
    b52: "bk0",
    b55: "bix",
    b58: "bk7",
    b59: "bkb",
    b60: "bkl",
    b61: "bkg",
    b65: "bka",
    b67: "bkm",
    b68: "bj8"
  },
  skillUpgrades: {
    sx8: {
      "2": "sxe"
    },
    sx9: {
      "4": "sxg"
    },
    sxa: {
      "1": "sxd",
      "5": "sxh"
    },
    sxc: {
      "3": "sxf",
      "6": "sxj"
    },
    sk4: {
      "2": "ski"
    },
    sk5: {
      "1": "skd",
      "6": "skm"
    },
    sk6: {
      "5": "skl"
    },
    sk7: {
      "3": "skj",
      "4": "skk"
    },
    sk8: {
      "1": "ske"
    },
    ska: {
      "1": "skf"
    },
    suo: {
      "3": "sv4"
    },
    sup: {
      "2": "sv1",
      "5": "sv7"
    },
    suq: {
      "1": "suy",
      "4": "sv5"
    },
    sur: {
      "6": "sva"
    },
    sus: {
      "2": "sv2",
      "5": "sv8"
    },
    sut: {
      "2": "sv3",
      "5": "sv9"
    },
    suw: {
      "1": "suz",
      "4": "sv6"
    },
    s10d: {
      "4": "s10k",
      "5": "s10l"
    },
    s10f: {
      "1": "s10h",
      "6": "s10m"
    },
    s10g: {
      "2": "s10i",
      "3": "s10j"
    },
    sly: {
      "2": "sm3",
      "6": "sm7"
    },
    slz: {
      "5": "sm6"
    },
    sm0: {
      "1": "sm2"
    },
    sm1: {
      "3": "sm4",
      "4": "sm5"
    },
    sd5: {
      "3": "sdb"
    },
    sd6: {
      "5": "sdd"
    },
    sd7: {
      "4": "sdc",
      "6": "sde"
    },
    sd8: {
      "1": "sd9",
      "2": "sda"
    },
    sb1: {
      "1": "sb5",
      "6": "sba"
    },
    sb2: {
      "2": "sb6"
    },
    sb3: {
      "3": "sb7"
    },
    sb4: {
      "4": "sb8",
      "5": "sb9"
    },
    szv: {
      "2": "s100",
      "5": "s103"
    },
    szw: {
      "4": "s102"
    },
    szx: {
      "3": "s101"
    },
    szy: {
      "1": "szz",
      "6": "s104"
    },
    s79: {
      "4": "s7g",
      "6": "s7i"
    },
    s7a: {
      "1": "s7d"
    },
    s7b: {
      "2": "s7e"
    },
    s7c: {
      "3": "s7f",
      "5": "s7h"
    },
    se8: {
      "3": "see",
      "6": "seh"
    },
    se9: {
      "1": "sec"
    },
    sea: {
      "2": "sed"
    },
    seb: {
      "4": "sef",
      "5": "seg"
    },
    sai: {
      "1": "sam",
      "5": "saq"
    },
    saj: {
      "4": "sap"
    },
    sak: {
      "3": "sao"
    },
    sal: {
      "2": "san",
      "6": "sar"
    },
    s18u: {
      "3": "s193",
      "6": "s196"
    },
    s18v: {
      "2": "s192",
      "5": "s195"
    },
    s18w: {
      "1": "s191"
    },
    s18x: {
      "4": "s194"
    },
    skw: {
      "4": "sl3",
      "6": "sl5"
    },
    skx: {
      "5": "sl4"
    },
    sky: {
      "2": "sl1"
    },
    skz: {
      "1": "sl0",
      "3": "sl2"
    },
    swk: {
      "2": "sws",
      "4": "swv"
    },
    swm: {
      "3": "swu",
      "5": "sww"
    },
    swn: {
      "1": "swq",
      "6": "swx"
    },
    swo: {
      "2": "swt"
    },
    swp: {
      "1": "swr",
      "6": "swy"
    },
    s8v: {
      "3": "s91",
      "5": "s93"
    },
    s8w: {
      "1": "s8z"
    },
    s8x: {
      "2": "s90"
    },
    s8y: {
      "4": "s92",
      "6": "s94"
    },
    snm: {
      "2": "snr",
      "5": "snu"
    },
    snn: {
      "1": "snq"
    },
    sno: {
      "4": "snt",
      "6": "snv"
    },
    snp: {
      "3": "sns"
    },
    sya: {
      "3": "syg"
    },
    syb: {
      "4": "syh"
    },
    syc: {
      "1": "sye",
      "5": "syi"
    },
    syd: {
      "2": "syf",
      "6": "syj"
    },
    sfu: {
      "2": "sfz"
    },
    sfv: {
      "4": "sg1"
    },
    sfw: {
      "3": "sg0",
      "5": "sg2"
    },
    sfx: {
      "1": "sfy",
      "6": "sg3"
    },
    sp8: {
      "3": "spe",
      "6": "sph"
    },
    sp9: {
      "4": "spf"
    },
    spa: {
      "1": "spc",
      "5": "spg"
    },
    spb: {
      "2": "spd"
    },
    s19l: {
      "5": "s19x"
    },
    s19m: {
      "1": "s19q",
      "6": "s1a0"
    },
    s19n: {
      "4": "s19v"
    },
    s19o: {
      "2": "s19r",
      "3": "s19t"
    },
    s19p: {
      "5": "s19y"
    },
    s198: {
      "6": "s1a1"
    },
    s199: {
      "4": "s19w"
    },
    s19a: {
      "5": "s19z"
    },
    s19b: {
      "2": "s19s",
      "3": "s19u"
    },
    s67: {
      "3": "s6d",
      "5": "s6f"
    },
    s68: {
      "1": "s6b"
    },
    s69: {
      "2": "s6c"
    },
    s6a: {
      "4": "s6e",
      "6": "s6g"
    },
    sgd: {
      "3": "sgj",
      "6": "sgm"
    },
    sge: {
      "1": "sgh"
    },
    sgf: {
      "5": "sgl"
    },
    sgg: {
      "2": "sgi",
      "4": "sgk"
    },
    sso: {
      "2": "st3",
      "6": "stb"
    },
    ssq: {
      "1": "st1",
      "4": "st8"
    },
    ssy: {
      "3": "st6",
      "5": "st9"
    },
    sss: {
      "2": "st4",
      "6": "stc"
    },
    ssz: {
      "1": "st2",
      "3": "st7",
      "5": "sta"
    },
    s7s: {
      "4": "s80",
      "6": "s82"
    },
    s7t: {
      "2": "s7y"
    },
    s7u: {
      "3": "s7z"
    },
    s7w: {
      "1": "s7x",
      "5": "s81"
    },
    srk: {
      "3": "srr",
      "5": "sru"
    },
    srl: {
      "4": "srt"
    },
    srm: {
      "2": "srq"
    },
    srn: {
      "1": "srp",
      "6": "srv"
    },
    sro: {
      "3": "srs"
    },
    svj: {
      "2": "svo",
      "5": "svr"
    },
    svk: {
      "4": "svq"
    },
    svl: {
      "3": "svp"
    },
    svm: {
      "1": "svn",
      "6": "svs"
    },
    stm: {
      "2": "sts",
      "6": "stw"
    },
    stn: {
      "4": "stu"
    },
    sto: {
      "5": "stv"
    },
    stp: {
      "1": "str",
      "3": "stt"
    },
    shg: {
      "4": "shn",
      "5": "sho"
    },
    shh: {
      "1": "shk"
    },
    shi: {
      "2": "shl"
    },
    shj: {
      "3": "shm",
      "6": "shp"
    },
    s10v: {
      "4": "s116"
    },
    s10w: {
      "3": "s115",
      "6": "s118"
    },
    s10x: {
      "2": "s114"
    },
    s10y: {
      "1": "s112",
      "5": "s117"
    },
    szb: {
      "1": "szf",
      "3": "szi"
    },
    szc: {
      "5": "szl"
    },
    szd: {
      "4": "szk"
    },
    sze: {
      "2": "szh",
      "6": "szm"
    },
    sjl: {
      "1": "sjp",
      "3": "sjr"
    },
    sjm: {
      "5": "sjt"
    },
    sjn: {
      "6": "sju"
    },
    sjo: {
      "2": "sjq",
      "4": "sjs"
    },
    sfa: {
      "2": "sfg",
      "6": "sfk"
    },
    sfc: {
      "1": "sff"
    },
    sfd: {
      "4": "sfi"
    },
    sfe: {
      "3": "sfh",
      "5": "sfj"
    },
    soo: {
      "1": "sot",
      "5": "sox"
    },
    sop: {
      "4": "sow"
    },
    soq: {
      "3": "sov"
    },
    sor: {
      "2": "sou",
      "6": "soy"
    },
    s145: {
      "3": "s14k"
    },
    s146: {
      "2": "s14f"
    },
    s14c: {
      "4": "s14l",
      "5": "s14m"
    },
    s14d: {
      "1": "s14e",
      "6": "s14n"
    },
    s147: {
      "2": "s14g"
    },
    ser: {
      "2": "sew",
      "3": "sex"
    },
    ses: {
      "1": "sev"
    },
    set: {
      "5": "sez"
    },
    seu: {
      "4": "sey",
      "6": "sf0"
    },
    sc3: {
      "2": "sc8",
      "4": "sca"
    },
    sc5: {
      "1": "sc7",
      "3": "sc9"
    },
    sc6: {
      "5": "scb",
      "6": "scc"
    },
    s12w: {
      "2": "s131"
    },
    s12x: {
      "1": "s130"
    },
    s12y: {
      "4": "s133"
    },
    s12z: {
      "3": "s132",
      "5": "s134",
      "6": "s135"
    },
    s6q: {
      "5": "s6y",
      "6": "s6z"
    },
    s6r: {
      "2": "s6v"
    },
    s6s: {
      "3": "s6w"
    },
    s6t: {
      "1": "s6u",
      "4": "s6x"
    },
    sqx: {
      "2": "sr4",
      "6": "sra"
    },
    sqy: {
      "4": "sr6",
      "5": "sr7"
    },
    sqz: {
      "1": "sr3"
    },
    sr0: {
      "3": "sr5"
    },
    sr1: {
      "5": "sr8"
    },
    s11z: {
      "3": "s12c",
      "4": "s12e"
    },
    s120: {
      "2": "s12b",
      "5": "s12g"
    },
    s121: {
      "1": "s12a"
    },
    s122: {
      "6": "s12h"
    },
    s123: {
      "3": "s12d",
      "4": "s12f"
    },
    s124: {
      "6": "s12i"
    },
    s125: {
      "6": "s12j"
    },
    s126: {
      "6": "s12k"
    },
    s127: {
      "6": "s12l"
    },
    s128: {
      "6": "s12m"
    },
    s129: {
      "6": "s12n"
    },
    sii: {
      "4": "sj7",
      "6": "sja"
    },
    sij: {
      "1": "siy"
    },
    sik: {
      "2": "sj2"
    },
    sil: {
      "3": "sj5",
      "5": "sj8"
    },
    sip: {
      "1": "sj0"
    },
    spr: {
      "2": "spw",
      "6": "sq0"
    },
    sps: {
      "5": "spz"
    },
    spt: {
      "4": "spy"
    },
    spu: {
      "1": "spv",
      "3": "spx"
    },
    s9e: {
      "1": "s9k"
    },
    s9f: {
      "2": "s9l"
    },
    s9i: {
      "3": "s9m",
      "4": "s9n"
    },
    s9j: {
      "5": "s9o",
      "6": "s9p"
    },
    su5: {
      "4": "suc"
    },
    su6: {
      "2": "sua"
    },
    su7: {
      "1": "su9",
      "6": "sue"
    },
    su8: {
      "3": "sub",
      "5": "sud"
    },
    scm: {
      "4": "sct",
      "5": "scu"
    },
    scn: {
      "1": "scq"
    },
    sco: {
      "2": "scr"
    },
    scp: {
      "3": "scs",
      "6": "scv"
    },
    sn4: {
      "1": "sn8",
      "6": "snd"
    },
    sn5: {
      "5": "snc"
    },
    sn6: {
      "4": "snb"
    },
    sn7: {
      "2": "sn9",
      "3": "sna"
    },
    ss5: {
      "4": "ssc"
    },
    ss6: {
      "1": "ss9"
    },
    ss7: {
      "2": "ssa",
      "5": "ssd"
    },
    ss8: {
      "3": "ssb",
      "6": "sse"
    },
    sdo: {
      "4": "sdv",
      "5": "sdw"
    },
    sdp: {
      "3": "sdu"
    },
    sdq: {
      "2": "sdt"
    },
    sdr: {
      "1": "sds",
      "6": "sdx"
    },
    sys: {
      "5": "sz0",
      "6": "sz1"
    },
    syt: {
      "2": "syx"
    },
    syu: {
      "4": "syz"
    },
    syv: {
      "1": "syw",
      "3": "syy"
    },
    s11h: {
      "2": "s11m",
      "4": "s11o"
    },
    s11j: {
      "1": "s11l",
      "5": "s11p"
    },
    s11k: {
      "3": "s11n",
      "6": "s11q"
    },
    s9z: {
      "2": "sa4",
      "5": "sa7"
    },
    sa0: {
      "1": "sa3"
    },
    sa1: {
      "3": "sa5"
    },
    sa2: {
      "4": "sa6",
      "6": "sa8"
    },
    s13e: {
      "5": "s13s"
    },
    s13f: {
      "1": "s13l"
    },
    s13g: {
      "2": "s13n",
      "3": "s13p"
    },
    s13h: {
      "4": "s13r",
      "6": "s13t"
    },
    s13j: {
      "1": "s13m"
    },
    s13k: {
      "2": "s13o",
      "3": "s13q"
    },
    sml: {
      "2": "smq",
      "5": "smt"
    },
    smm: {
      "4": "sms"
    },
    smn: {
      "1": "smp"
    },
    smo: {
      "3": "smr",
      "6": "smu"
    },
    shz: {
      "1": "si3",
      "6": "si8"
    },
    si0: {
      "4": "si6"
    },
    si1: {
      "3": "si5"
    },
    si2: {
      "2": "si4",
      "5": "si7"
    },
    sbk: {
      "3": "sbq",
      "6": "sbt"
    },
    sbl: {
      "1": "sbo"
    },
    sbm: {
      "2": "sbp"
    },
    sbn: {
      "4": "sbr",
      "5": "sbs"
    },
    sgx: {
      "4": "sh4",
      "6": "sh6"
    },
    sgy: {
      "3": "sh3"
    },
    sgz: {
      "1": "sh1"
    },
    sh0: {
      "2": "sh2",
      "5": "sh5"
    },
    slf: {
      "2": "slk",
      "6": "slo"
    },
    slg: {
      "3": "sll"
    },
    slh: {
      "4": "slm"
    },
    sli: {
      "1": "slj",
      "5": "sln"
    },
    s8c: {
      "1": "s8g"
    },
    s8d: {
      "2": "s8h"
    },
    s8e: {
      "3": "s8i",
      "6": "s8l"
    },
    s8f: {
      "4": "s8j",
      "5": "s8k"
    },
    sxs: {
      "2": "sxx",
      "5": "sy0"
    },
    sxt: {
      "1": "sxw",
      "4": "sxz"
    },
    sxu: {
      "3": "sxy"
    },
    sxv: {
      "6": "sy1"
    },
    sw1: {
      "3": "sw7",
      "5": "sw9"
    },
    sw2: {
      "1": "sw5"
    },
    sw3: {
      "4": "sw8"
    },
    sw4: {
      "2": "sw6",
      "6": "swa"
    },
    sqa: {
      "1": "sqg",
      "3": "sqk"
    },
    sqb: {
      "4": "sql"
    },
    sqc: {
      "5": "sqm"
    },
    sqd: {
      "2": "sqh",
      "6": "sqn"
    },
    sqe: {
      "2": "sqi"
    },
    sqf: {
      "2": "sqj"
    },
    so5: {
      "3": "sob",
      "6": "soe"
    },
    so6: {
      "4": "soc"
    },
    so7: {
      "2": "soa"
    },
    so8: {
      "1": "so9",
      "5": "sod"
    }
  },
  skillReplacements: {
    sm0: {
      f5l: {
        id: "s1kz",
        levels: {
          "1": "s1l0"
        }
      }
    },
    sd6: {
      f2m: {
        id: "s1jt",
        levels: {
          "5": "s1ju"
        }
      }
    },
    sb2: {
      f1t: {
        id: "s1jd",
        levels: {
          "2": "s1je"
        }
      }
    },
    sb3: {
      f1v: {
        id: "s1jf",
        levels: {
          "3": "s1jg"
        }
      }
    },
    s7a: {
      fe: {
        id: "s1io",
        levels: {
          "1": "s1ip"
        }
      }
    },
    s7b: {
      fg: {
        id: "s1iq",
        levels: {
          "2": "s1ir"
        }
      }
    },
    se9: {
      f31: {
        id: "s1jz",
        levels: {
          "1": "s1k0"
        }
      }
    },
    sea: {
      f32: {
        id: "s1k1",
        levels: {
          "2": "s1k2"
        }
      }
    },
    saj: {
      f1k: {
        id: "s1j9",
        levels: {
          "4": "s1ja"
        }
      }
    },
    sak: {
      f1n: {
        id: "s1jb",
        levels: {
          "3": "s1jc"
        }
      }
    },
    swk: {
      f90: {
        id: "s1lk",
        levels: {
          "2": "s1ll",
          "4": "s1lm"
        }
      }
    },
    swl: {
      f91: {
        id: "s1ln",
        levels: {}
      }
    },
    s8w: {
      f12: {
        id: "s1j1",
        levels: {
          "1": "s1j2"
        }
      }
    },
    s8x: {
      f10: {
        id: "s1iz",
        levels: {
          "2": "s1j0"
        }
      }
    },
    sp8: {
      f6r: {
        id: "s1lc",
        levels: {
          "3": "s1ld",
          "6": "s1le"
        }
      }
    },
    s67: {
      f0: {
        id: "s1ih",
        levels: {
          "3": "s1ii",
          "5": "s1ij"
        }
      }
    },
    s68: {
      f1: {
        id: "s1ik",
        levels: {
          "1": "s1il"
        }
      }
    },
    s69: {
      f3: {
        id: "s1im",
        levels: {
          "2": "s1in"
        }
      }
    },
    sge: {
      f3r: {
        id: "s1kb",
        levels: {
          "1": "s1kc"
        }
      }
    },
    sgf: {
      f3t: {
        id: "s1kd",
        levels: {
          "5": "s1ke"
        }
      }
    },
    s7t: {
      fm: {
        id: "s7v",
        levels: {
          "2": "s1is"
        }
      }
    },
    s7u: {
      fo: {
        id: "s1it",
        levels: {
          "3": "s1iu"
        }
      }
    },
    svm: {
      f8l: {
        id: "s1lh",
        levels: {
          "1": "s1li",
          "6": "s1lj"
        }
      }
    },
    shh: {
      f49: {
        id: "s1kh",
        levels: {
          "1": "s1ki"
        }
      }
    },
    shi: {
      f4a: {
        id: "s1kj",
        levels: {
          "2": "s1kk"
        }
      }
    },
    sjm: {
      f4u: {
        id: "s1kt",
        levels: {
          "5": "s1ku"
        }
      }
    },
    sjn: {
      f4v: {
        id: "s1kv",
        levels: {
          "6": "s1kw"
        }
      }
    },
    sfc: {
      f3c: {
        id: "s1k7",
        levels: {
          "1": "s1k8"
        }
      }
    },
    sfd: {
      f3e: {
        id: "s1k9",
        levels: {
          "4": "s1ka"
        }
      }
    },
    sop: {
      f6i: {
        id: "s1l8",
        levels: {
          "4": "s1l9"
        }
      }
    },
    soq: {
      f6j: {
        id: "s1la",
        levels: {
          "3": "s1lb"
        }
      }
    },
    ses: {
      f36: {
        id: "s1k3",
        levels: {
          "1": "s1k4"
        }
      }
    },
    set: {
      f38: {
        id: "s1k5",
        levels: {
          "5": "s1k6"
        }
      }
    },
    sc4: {
      f2a: {
        id: "s1jo",
        levels: {}
      }
    },
    sc5: {
      f28: {
        id: "s1jl",
        levels: {
          "1": "s1jm",
          "3": "s1jn"
        }
      }
    },
    sqz: {
      f7a: {
        id: "s1lf",
        levels: {
          "1": "s1lg"
        }
      }
    },
    s122: {
      far: {
        id: "s1lo",
        levels: {
          "6": "s1lp"
        }
      }
    },
    sij: {
      f4j: {
        id: "s1kp",
        levels: {
          "1": "s1kq"
        }
      }
    },
    sik: {
      f4m: {
        id: "s1kr",
        levels: {
          "2": "s1ks"
        }
      }
    },
    s9e: {
      f1b: {
        id: "s1j3",
        levels: {
          "1": "s1j4"
        }
      }
    },
    s9f: {
      f19: {
        id: "s9g",
        levels: {
          "2": "s9h"
        }
      }
    },
    scn: {
      f2g: {
        id: "s1jr",
        levels: {
          "1": "s1js"
        }
      }
    },
    sco: {
      f2f: {
        id: "s1jp",
        levels: {
          "2": "s1jq"
        }
      }
    },
    sdp: {
      f2u: {
        id: "s1jv",
        levels: {
          "3": "s1jw"
        }
      }
    },
    sdq: {
      f2v: {
        id: "s1jx",
        levels: {
          "2": "s1jy"
        }
      }
    },
    sa0: {
      f1h: {
        id: "s1j7",
        levels: {
          "1": "s1j8"
        }
      }
    },
    sa1: {
      f1g: {
        id: "s1j5",
        levels: {
          "3": "s1j6"
        }
      }
    },
    sml: {
      f5p: {
        id: "s1l1",
        levels: {
          "2": "s1l2",
          "5": "s1l3"
        }
      }
    },
    smn: {
      f5v: {
        id: "s1lr",
        levels: {
          "1": "s1ls"
        }
      }
    },
    si0: {
      f4c: {
        id: "s1kl",
        levels: {
          "4": "s1km"
        }
      }
    },
    si1: {
      f4e: {
        id: "s1kn",
        levels: {
          "3": "s1ko"
        }
      }
    },
    sbl: {
      f1z: {
        id: "s1jh",
        levels: {
          "1": "s1ji"
        }
      }
    },
    sbm: {
      f21: {
        id: "s1jj",
        levels: {
          "2": "s1jk"
        }
      }
    },
    sgz: {
      f3x: {
        id: "s1kf",
        levels: {
          "1": "s1kg"
        }
      }
    },
    slg: {
      f5b: {
        id: "s1kx",
        levels: {
          "3": "s1ky"
        }
      }
    },
    s8c: {
      ft: {
        id: "s1iv",
        levels: {
          "1": "s1iw"
        }
      }
    },
    s8d: {
      fv: {
        id: "s1ix",
        levels: {
          "2": "s1iy"
        }
      }
    },
    so6: {
      f6a: {
        id: "s1l4",
        levels: {
          "4": "s1l5"
        }
      }
    },
    so7: {
      f6c: {
        id: "s1l6",
        levels: {
          "2": "s1l7"
        }
      }
    }
  },
  summonOwners: {
    s1: "dp",
    s2: "d17",
    s3: "d17",
    s4: "d1a",
    s5: "d14",
    s6: "d1i",
    s7: "d11",
    s8: "dn",
    s9: "d1n",
    s10: "d1n",
    s11: "d1n",
    s12: "d1f",
    s13: "dt"
  }
};

// src/store/migration.ts
var SaveImportError = class extends Error {
};
var mapping = id_mapping_default;
var flatKeyLookup = {};
for (const table of Object.values(mapping.keys)) {
  for (const [oldId, newId] of Object.entries(table)) {
    if (!/^k\d+$/.test(oldId)) flatKeyLookup[oldId] = newId;
  }
}
function toBuffList(buffs) {
  if (!Array.isArray(buffs)) return [];
  return buffs.filter((b) => typeof b === "string");
}
function isLegacySummonId(id) {
  return /^s\d+$/.test(id);
}
function lookup(table, id, what) {
  const result = table?.[id];
  if (result === void 0) throw new SaveImportError(`[v8->v9] No mapping for ${what} "${id}"`);
  return result;
}
function mapKey(dollId, keyId) {
  const own = mapping.keys[dollId]?.[keyId];
  if (own !== void 0) return own;
  return lookup(flatKeyLookup, keyId, `key (on doll ${dollId})`);
}
function makeResolvers(newDolls) {
  const resolved = new Map(newDolls.map((sd) => [sd.id, getSelectedDoll(sd, true)]));
  function summon(oldId) {
    const base = lookup(mapping.summons, oldId, "summon");
    const owner2 = resolved.get(lookup(mapping.summonOwners, oldId, "summon owner"));
    if (!owner2 || !hasSummonFamily(base, owner2)) return base;
    return resolveSummon2(base, owner2).id;
  }
  function skill(oldOwnerId, skillNumber) {
    if (skillNumber === END_TURN_SKILL_ID) return V9_END_TURN_SKILL_ID;
    const base = lookup(mapping.skills[oldOwnerId], String(skillNumber), `skill of ${oldOwnerId}`);
    let entity;
    if (isLegacySummonId(oldOwnerId)) {
      const doll = resolved.get(lookup(mapping.summonOwners, oldOwnerId, "summon owner"));
      const summonId = summon(oldOwnerId);
      entity = doll && hasSummonFamily(summonId, doll) ? resolveSummon2(summonId, doll) : void 0;
    } else {
      entity = resolved.get(lookup(mapping.dolls, oldOwnerId, "doll"));
    }
    if (!entity || !hasSkillFamily(base, entity)) return base;
    return resolveSkill2(base, entity).id;
  }
  function owner(oldId) {
    return isLegacySummonId(oldId) ? summon(oldId) : lookup(mapping.dolls, oldId, "doll");
  }
  return { summon, skill, owner };
}
function mergeActions(actions, resolve) {
  const merged = {};
  for (const [oldOwnerId, list] of Object.entries(actions)) {
    const converted = list.map(([skill, target]) => {
      const id = resolve.skill(oldOwnerId, skill);
      return target === void 0 ? [id] : [id, resolve.owner(target)];
    });
    const ownerId = resolve.owner(oldOwnerId);
    merged[ownerId] = [...merged[ownerId] ?? [], ...converted];
  }
  return merged;
}
function mapRecordKeys(rec, fn) {
  return Object.fromEntries(Object.entries(rec).map(([k, v]) => [fn(k), v]));
}
function v8ToV9SelectedDoll(doll) {
  return {
    id: lookup(mapping.dolls, doll.id, "doll"),
    fortification: doll.fortification,
    // some v7/v8 saves have null for an empty slot
    keys: doll.keys.map((k) => k === null || k === "" ? "" : mapKey(doll.id, k)),
    // v8 could store remolding levels the game doesn't have; fall back to the first real one
    remoldingLvl: REMOLDING_LEVELS.includes(doll.remoldingLvl) ? doll.remoldingLvl : REMOLDING_LEVELS[0],
    gun: doll.gun === "" ? getWeaponByDollId(lookup(mapping.dolls, doll.id, "doll")).id : lookup(mapping.weapons, doll.gun, "weapon"),
    borrow: doll.borrow
  };
}
function v8ToV9(save) {
  const tabDataBugfix = structuredClone(save.tabData);
  for (const tab of tabDataBugfix) {
    for (const key of Object.keys(tab.dollPositions)) {
      if (!hasPrefix(key, "d" /* Dolls */)) {
        delete tab.dollPositions[key];
      }
    }
  }
  const newSelectedDolls = save.selectedDolls.map(v8ToV9SelectedDoll);
  const resolve = makeResolvers(newSelectedDolls);
  const newTabData = tabDataBugfix.map((tab) => ({
    // several old ids can map to one new id (e.g. Mityl's s10 and s11), so dedupe the order and merge their actions
    actionOrder: [...new Set(tab.actionOrder.map(resolve.owner))],
    actions: mergeActions(tab.actions, resolve),
    dollPositions: mapRecordKeys(tab.dollPositions, (id) => lookup(mapping.dolls, id, "doll")),
    summonPositions: tab.summonPositions.map((s) => ({
      ...s,
      id: resolve.summon(s.id)
    }))
  }));
  return {
    selectedDolls: newSelectedDolls,
    // older v8 saves can be missing the map
    map: save.map ?? "Blade Guard Titan",
    score: save.score,
    description: save.description,
    buffs: toBuffList(save.buffs).map((b) => lookup(mapping.buffs, b, "buff")),
    tabData: assignUniqueInstanceIds(cleanUpSummons(newTabData, newSelectedDolls)),
    version: V9_SAVE_VERSION
  };
}
function cleanUpSummons(tabs, dolls) {
  const selected = new Set(dolls.map((d) => d.id));
  return tabs.map((original, tabIndex) => {
    let tab = original;
    if (tabIndex === 0 && tab.summonPositions.length) {
      log.info(`[v8->v9] Setup: removed summons, which can only be placed from turn 1`, tab.summonPositions);
      tab = { ...tab, summonPositions: [] };
    }
    for (const position of tab.summonPositions) {
      const ownerId = getSummonOwnerId(position.id);
      if (!selected.has(ownerId)) {
        const summonName = getSummonRequirement(position.id).name;
        throw new SaveImportError(
          `[v8->v9] Turn ${tabIndex}: ${summonName} (${position.id}) is on the map, but ${getDollById(ownerId).name} (${ownerId}) is not in the team`
        );
      }
    }
    const placed = new Set(tab.summonPositions.map((p) => p.id));
    const isUnplacedSummon = (id) => hasPrefix(id, "m" /* Summons */) && !placed.has(id);
    const removedActions = {};
    const removedListings = {};
    const actions = {};
    for (const [ownerKey, list] of Object.entries(tab.actions)) {
      const ownerId = ownerKey;
      if (isUnplacedSummon(ownerId)) {
        if (list.length) removedActions[ownerId] = list;
      } else if (hasPrefix(ownerId, "m" /* Summons */) && !isEverPlayable(ownerId)) {
        if (list.length) removedListings[ownerId] = list;
      } else {
        actions[ownerId] = list;
      }
    }
    if (Object.keys(removedActions).length) {
      log.info(`[v8->v9] Turn ${tabIndex}: removed summons that are not on the map`, {
        actionOrder: tab.actionOrder.filter((id) => id in removedActions),
        actions: removedActions
      });
    }
    if (Object.keys(removedListings).length) {
      log.info(`[v8->v9] Turn ${tabIndex}: removed listings of summons that are never playable`, removedListings);
    }
    return { ...tab, actionOrder: tab.actionOrder.filter((id) => !isUnplacedSummon(id)), actions };
  });
}
var INSTANCE_ID_SOURCE_LABELS = {
  sameTile: "continued from the previous turn (same tile)",
  sameOldId: "continued from the previous turn (same old id, moved)",
  new: "new instance"
};
var INSTANCE_ID_SOURCE_SHORT = {
  sameTile: "same tile",
  sameOldId: "moved",
  new: "new"
};
function assignUniqueInstanceIds(tabs) {
  let next = 0;
  let previous = [];
  return tabs.map((tab, tabIndex) => {
    const unclaimed = [...previous];
    const claim = (matches) => {
      const index = unclaimed.findIndex(matches);
      return index === -1 ? "" : unclaimed.splice(index, 1)[0].mapId;
    };
    const current = tab.summonPositions.map((p) => ({
      base: summonBaseIdOf(p.id),
      // v8 placements can be missing their id entirely
      oldMapId: p.mapId ?? "",
      x: p.x,
      y: p.y,
      mapId: "",
      source: void 0
    }));
    const assign = (c, mapId, source) => {
      if (!mapId) return;
      c.mapId = mapId;
      c.source = source;
    };
    for (const c of current)
      assign(
        c,
        claim((p) => p.base === c.base && p.x === c.x && p.y === c.y),
        "sameTile"
      );
    for (const c of current) {
      if (!c.source && c.oldMapId)
        assign(
          c,
          claim((p) => p.base === c.base && p.oldMapId === c.oldMapId),
          "sameOldId"
        );
    }
    for (const c of current) if (!c.source) assign(c, `s${next++}`, "new");
    logInstanceIds(tabIndex, tab.summonPositions, current);
    const summonPositions = tab.summonPositions.map((p, i) => ({ ...p, mapId: current[i].mapId }));
    previous = current;
    return { ...tab, summonPositions };
  });
}
function logInstanceIds(tabIndex, positions, instances) {
  const groups = {};
  const counts = [];
  for (const source of Object.keys(INSTANCE_ID_SOURCE_LABELS)) {
    const entries = positions.flatMap((p, i) => {
      const { mapId, oldMapId } = instances[i];
      if (instances[i].source !== source || mapId === oldMapId) return [];
      return [`${p.id} at (${p.x}, ${p.y}): ${oldMapId || "(no id)"} -> ${mapId}`];
    });
    if (!entries.length) continue;
    groups[INSTANCE_ID_SOURCE_LABELS[source]] = entries;
    counts.push(`${entries.length} ${INSTANCE_ID_SOURCE_SHORT[source]}`);
  }
  if (!counts.length) return;
  log.info(`[v8->v9] Turn ${tabIndex}: summon instance ids (${counts.join(", ")})`, groups);
}
function v7ToV8(data) {
  const v8SelectedDolls = structuredClone(data.selectedDolls).map((d) => ({
    id: d.id,
    fortification: d.fortification ?? 0,
    keys: d.keys?.length === 8 ? d.keys.map((k) => k ?? "") : Array(8).fill(""),
    remoldingLvl: d.remoldingLvl ?? 1,
    gun: d.gun ?? "",
    borrow: d.borrow ?? false
  }));
  const v8TabData = Array.from({ length: 8 }, (_, i) => data.tabData[i] ? structuredClone(data.tabData[i]) : makeV8DefaultTabData());
  return {
    selectedDolls: v8SelectedDolls,
    currentTab: data.currentTab,
    map: data.map ?? "Tusk Beasteel",
    score: 0,
    description: "",
    buffs: toBuffList(data.buffs),
    tabData: v8TabData,
    version: 8
  };
}
function makeV8DefaultTabData() {
  return { actionOrder: [], actions: {}, dollPositions: {}, summonPositions: [] };
}
function assertSave(save) {
  if (!save || typeof save !== "object" || !("version" in save) || typeof save.version !== "number") {
    throw new SaveImportError("Not a save: the data has no version number");
  }
  if (save.version < 7) {
    throw new SaveImportError(`Save version ${save.version} is too old (oldest supported is 7)`);
  }
  if (save.version > V10_SAVE_VERSION) {
    throw new SaveImportError(`Save version ${save.version} is newer than this app supports (${V10_SAVE_VERSION})`);
  }
  if (save.version >= 7 && save.version < 10) {
    if (!("selectedDolls" in save) || !Array.isArray(save.selectedDolls)) {
      throw new SaveImportError(`Save version ${save.version} has no selectedDolls list`);
    }
    if (!("tabData" in save) || !Array.isArray(save.tabData)) {
      throw new SaveImportError(`Save version ${save.version} has no tabData list`);
    }
  }
  if (save.version >= 10) {
    if (!("dolls" in save) || !Array.isArray(save.dolls)) {
      throw new SaveImportError(`Save version ${save.version} has no dolls list`);
    }
    if (!("turns" in save) || !Array.isArray(save.turns)) {
      throw new SaveImportError(`Save version ${save.version} has no turns list`);
    }
  }
  return save;
}
function upgradeSave(raw) {
  let save = assertSave(raw);
  if (save.version === 7) save = v7ToV8(save);
  if (save.version === 8) save = v8ToV9(save);
  if (save.version !== V9_SAVE_VERSION) throw new SaveImportError(`Save version ${save.version} can't be loaded yet`);
  return save;
}
function migrate() {
  if (!localStorage.getItem(V9_LOCAL_STATE)) {
    const local = structuredClone(defaultLocalState);
    if (localStorage.getItem(V8_SKILL_DISPLAY_KEY)) {
      const v8Skills = localStorageLoad(V8_SKILL_DISPLAY_KEY);
      if (v8Skills && typeof v8Skills === "object" && "skillDisplay" in v8Skills && Array.isArray(v8Skills.skillDisplay)) {
        for (const [index, value] of v8Skills.skillDisplay.entries()) {
          if (typeof value === "number") {
            local.skillDisplay[index] = value;
          }
        }
      }
    } else if (localStorage.getItem(V7_SKILL_DISPLAY_KEY)) {
      const v7Skills = localStorageLoad(V7_SKILL_DISPLAY_KEY);
      if (v7Skills && typeof v7Skills === "object" && "skillDisplay" in v7Skills && Array.isArray(v7Skills.skillDisplay)) {
        for (const [index, value] of v7Skills.skillDisplay.entries()) {
          if (typeof value === "number") {
            local.skillDisplay[index] = value;
          }
        }
      }
    }
    localStorage.setItem(V9_LOCAL_STATE, JSON.stringify(local));
  }
  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
  for (const key of keys) {
    if (key && key.startsWith("gunsmoke_doll_") && key.endsWith("_v8")) {
      try {
        const loadout = localStorageLoad(key);
        if (loadout) {
          const newLoadout = v8ToV9SelectedDoll(loadout);
          localStorage.setItem(V9_DOLL_LOADOUT_KEY(newLoadout.id), JSON.stringify(newLoadout));
          localStorage.removeItem(key);
        }
      } catch (e) {
        log.error(`Couldn't migrate the saved v8 doll loadout "${key}"`, e);
      }
    }
  }
}

// src/store/persistence.ts
function resetToDefaultState() {
  setStateFromURL(false);
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  localStorage.setItem(V9_STORAGE_KEY, JSON.stringify(defaultState));
}
function saveLocalState() {
  localStorage.setItem(V9_LOCAL_STATE, JSON.stringify(localState));
}
function loadLocalState() {
  const ls = localStorageLoad(V9_LOCAL_STATE);
  setLocalState(
    produce((s) => {
      s.alwaysDisplaySkills = ls?.alwaysDisplaySkills ?? true;
      s.currentTab = ls?.currentTab ?? 0;
      s.exportIncludeDolls = ls?.exportIncludeDolls ?? false;
      s.exportDiscord = ls?.exportDiscord ?? false;
      s.exportAsLink = ls?.exportAsLink ?? false;
      s.exportIncludeSeason = ls?.exportIncludeSeason ?? false;
      s.exportIncludeBoss = ls?.exportIncludeBoss ?? false;
      s.skillDisplay = new Array(notations.size).fill(0);
      const importedSkillDisplay = ls?.skillDisplay ?? [];
      for (const [index, value] of importedSkillDisplay.entries()) {
        if (typeof value === "number") {
          s.skillDisplay[index] = value;
        }
      }
    })
  );
}
function compareStateHash() {
  const storedState = localStorageLoad(V9_STORAGE_KEY);
  if (!storedState) return false;
  const clone = toSave();
  const oldState = {
    selectedDolls: storedState.selectedDolls,
    map: storedState.map,
    customMap: storedState.customMap,
    buffs: storedState.buffs ?? [],
    tabData: storedState.tabData
  };
  const newState = {
    selectedDolls: clone.selectedDolls,
    map: clone.map,
    customMap: clone.customMap,
    buffs: clone.buffs ?? [],
    tabData: clone.tabData
  };
  return JSON.stringify(oldState) === JSON.stringify(newState);
}
function updateVisibleSkillOption(value) {
  setLocalState(
    produce((state2) => {
      state2.alwaysDisplaySkills = value;
    })
  );
}
function fillMissingInstanceIds(tabs) {
  for (const [tabIndex, tab] of tabs.entries()) {
    const filled = [];
    for (const p of tab.summonPositions) {
      if (p.mapId?.trim()) continue;
      const inThisTab = new Set(tab.summonPositions.map((q) => q.mapId));
      const previous = tabs[tabIndex - 1]?.summonPositions.find(
        (q) => summonBaseIdOf(q.id) === summonBaseIdOf(p.id) && q.x === p.x && q.y === p.y && q.mapId && !inThisTab.has(q.mapId)
      );
      p.mapId = previous?.mapId ?? nextSummonInstanceId(tabs);
      filled.push(`${p.id} at (${p.x}, ${p.y}) -> ${p.mapId}`);
    }
    if (filled.length) log.info(`Turn ${tabIndex}: gave summons without an instance id one`, filled);
  }
}
function buildState(save) {
  const selectedDolls = save.selectedDolls.map((d) => ({ ...d, keys: [...d.keys] }));
  const entities = selectedDolls.map((d) => ({ doll: d, summons: getSelectedDoll(d).summons.map((s) => s.id) }));
  const validIds = new Set(entities.flatMap((e) => [e.doll.id, ...e.summons]));
  const tabData = Array.from({ length: 8 }, (_, i) => {
    const src = save.tabData[i] ?? makeDefaultTabData();
    const dollPositions = structuredClone(src.dollPositions);
    const actions = structuredClone(src.actions);
    for (const { doll, summons } of entities) {
      dollPositions[doll.id] = { x: src.dollPositions[doll.id]?.x ?? -1, y: src.dollPositions[doll.id]?.y ?? -1 };
      for (const id of [doll.id, ...summons]) actions[id] ?? (actions[id] = []);
    }
    const order = new Set(src.actionOrder);
    for (const id of validIds) order.add(id);
    return {
      actionOrder: [...order],
      actions,
      dollPositions,
      summonPositions: structuredClone(src.summonPositions)
    };
  });
  fillMissingInstanceIds(tabData);
  return {
    version: V9_SAVE_VERSION,
    selectedDolls,
    map: save.map,
    ...embeddedMap(save),
    score: save.score ?? 0,
    description: save.description ?? "",
    buffs: [...save.buffs ?? []],
    tabData
  };
}
function embeddedMap(save) {
  if (save.customMap === void 0 || isBuiltInMap(save.map)) return {};
  try {
    const map = checkMap(save.customMap);
    return map.name === save.map ? { customMap: map } : {};
  } catch (e) {
    log.warn(`The timeline's copy of map "${save.map}" couldn't be read`, e);
    return {};
  }
}
async function applyState2(next) {
  setState(reconcile(next));
  loadMap(state.map);
  setupTempSelectedDolls();
  await preloadCanvasImages();
}
function toSave(s = state) {
  const clone = structuredClone(unwrap(s));
  clone.version = V9_SAVE_VERSION;
  if (clone.customMap && !isBuiltInMap(clone.map)) clone.customMap = toPlainMap(clone.customMap);
  else delete clone.customMap;
  clone.buffs.sort(sortBuffs);
  for (const doll of clone.selectedDolls) doll.keys.sort();
  return clone;
}
function describeSource(processFn) {
  if (processFn === loadFromWorker) return "Shared link (stateId)";
  if (processFn === loadFromString) return stateFromURL() ? "Shared link (state string)" : "Import panel";
  if (processFn === loadFromLocalStorage) return "Local save";
  return processFn.name || "unknown";
}
async function describeSaveData(processFn, data, raw) {
  if (processFn === loadFromString) return [`State: ${data.trim()}`];
  if (processFn === loadFromWorker) return [`State ID: ${data}`, `Cached state: ${localStorage.getItem(data) ?? "(not cached)"}`];
  if (raw == null) return ["State: (none)"];
  try {
    return [`State: ${await compressString(typeof raw === "string" ? raw : JSON.stringify(raw))}`];
  } catch {
    return ["State: (unavailable)"];
  }
}
async function buildErrorDetails(failure) {
  const { processFn, data, raw, stage, error, chain: chain2 } = failure;
  const version = raw && typeof raw === "object" && "version" in raw ? String(raw.version) : "unknown";
  const errorText = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const stack = error instanceof Error && error.stack ? error.stack : "(none)";
  return [
    "Gunsmoke import error",
    `Time: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    `Page: ${window.location.href}`,
    `User agent: ${navigator.userAgent}`,
    `Source: ${describeSource(processFn)}`,
    `Failed while: ${stage}`,
    `Save version: ${version}`,
    `Error: ${errorText}`,
    `Log scope: ${chain2.labels.join(" > ")} ${JSON.stringify(chain2.context)}`,
    ...await describeSaveData(processFn, data, raw),
    `Stack: ${stack}`
  ].join("\n");
}
async function importState(processFn, data) {
  var _stack = [];
  try {
    const scope = __using(_stack, logScope("importState", { source: processFn.name }));
    const isLocal = processFn === loadFromLocalStorage;
    let raw;
    let stage = "loading save";
    try {
      raw = await processFn(data);
      if (raw == null) throw new SaveImportError("No save data found");
      scope.add("version", raw.version);
      log.info("State before migration", raw);
      stage = "migrating save";
      const next = buildState(upgradeSave(raw));
      log.info("State after migration", structuredClone(next));
      stage = "applying save";
      await applyState2(next);
      stage = "validating and saving";
      const errors = validateSave(state);
      if (errors.length) {
        const messages = uniqueMessages(errors);
        log.warn(`Loaded timeline has ${messages.length} problem(s):
- ${messages.join("\n- ")}`, errors);
      }
      if (!isLocal) setLocalState("currentTab", 8);
      if (!stateFromURL()) saveToLocalStorage();
      return true;
    } catch (e) {
      const chain2 = currentChain();
      const details = await buildErrorDetails({ processFn, data, raw, stage, error: e, chain: chain2 });
      log.error("Error importing state", e, "\n" + details);
      if (isLocal) {
        if (raw !== void 0 && raw !== null) {
          if (typeof raw === "string") {
            localStorage.setItem(FAILED_STATE_BACKUP_KEY, raw);
          } else {
            localStorage.setItem(FAILED_STATE_BACKUP_KEY, JSON.stringify(raw));
          }
        }
        pushImportError({
          message: "Your saved timeline couldn't be loaded, so an empty timeline was started. A backup of the old save was kept.",
          details
        });
        await applyState2(buildState(structuredClone(defaultState)));
        return false;
      }
      pushImportError({ message: "This timeline couldn't be loaded, so your locally saved timeline was opened instead.", details });
      setStateFromURL(false);
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      return await importState(loadFromLocalStorage, "");
    }
  } catch (_) {
    var _error = _, _hasError = true;
  } finally {
    __callDispose(_stack, _error, _hasError);
  }
}
function loadFromLocalStorage(_data) {
  return new Promise((resolve) => {
    const v9 = localStorageLoad(V9_STORAGE_KEY);
    if (v9 !== null) {
      resolve(v9);
      return;
    }
    const v8 = localStorageLoad(V8_STORAGE_KEY);
    if (v8 !== null) {
      resolve(v8);
      return;
    }
    const v7 = localStorageLoad(V7_STORAGE_KEY);
    if (v7 !== null) {
      resolve(v7);
      return;
    }
    resolve(structuredClone(defaultState));
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
    throw new SaveImportError(`Server couldn't load shared timeline "${stateId}": ${data.error}`);
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
        if (removedState !== void 0) localStorage.removeItem(removedState);
      }
      localStorage.setItem(SAVED_STATES_KEY, JSON.stringify(savedStates));
    }
    localStorage.setItem(stateId, data.result.state);
    return JSON.parse(decompressed);
  }
  return null;
}
async function compress() {
  return await compressString(JSON.stringify(toSave()));
}
async function compressString(json) {
  const byteArray = new TextEncoder().encode(json);
  const cs = new CompressionStream("deflate");
  const readPromise = new Response(cs.readable).arrayBuffer();
  const writer = cs.writable.getWriter();
  await writer.write(byteArray);
  await writer.close();
  const buf = await readPromise;
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function decompress(b64) {
  const bytes = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const ds = new DecompressionStream("deflate");
  const readPromise = new Response(ds.readable).arrayBuffer();
  const writer = ds.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  return new TextDecoder().decode(await readPromise);
}

// src/store/storage.ts
function localStorageLoad(key) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item);
  } catch (e) {
    log.error("Error loading from localStorage", key, e);
    return null;
  }
}
function saveToLocalStorage() {
  setStateFromURL(false);
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
  localStorage.setItem(V9_STORAGE_KEY, JSON.stringify(toSave()));
}

// src/canvas/editorMap.ts
var empty__ = 0 /* Empty */;
var spawn__ = 1 /* Spawn */;
var hbound_ = 2 /* HBoundary */;
var hvbound = 2 /* HBoundary */ | 4 /* VBoundary */;
var hspawn_ = 2 /* HBoundary */ | 1 /* Spawn */;
var vbound_ = 4 /* VBoundary */;
var vspawn_ = 4 /* VBoundary */ | 1 /* Spawn */;
var hcover_ = 8 /* HalfCover */;
var fcover_ = 16 /* FullCover */;
var bosssub = 32 /* BossCover */;
var bossman = 64 /* BossOrigin */;
var maps = [{
  id: "temblorTitan",
  name: "Temblor Titan",
  width: 15,
  height: 15,
  locked: true,
  default: true,
  priority: [gridKey(7, 12, 15), gridKey(8, 12, 15), gridKey(7, 13, 15), gridKey(8, 13, 15), gridKey(6, 1, 15), gridKey(7, 1, 15), gridKey(6, 2, 15), gridKey(7, 2, 15)],
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
    hcover_,
    empty__,
    empty__,
    empty__,
    spawn__,
    spawn__,
    empty__,
    hbound_,
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
    hspawn_,
    hspawn_,
    empty__,
    hbound_,
    hcover_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    hcover_,
    hbound_,
    empty__,
    hbound_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    hcover_,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
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
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    empty__,
    hvbound,
    vbound_,
    empty__,
    empty__,
    bosssub,
    bosssub,
    bosssub,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    hvbound,
    vbound_,
    empty__,
    empty__,
    bosssub,
    bossman,
    bosssub,
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
    bosssub,
    bosssub,
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
    empty__,
    empty__,
    empty__,
    hbound_,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    hbound_,
    hbound_,
    empty__,
    empty__,
    hbound_,
    hcover_,
    empty__,
    empty__,
    empty__,
    hbound_,
    hcover_,
    hcover_,
    hcover_,
    empty__,
    empty__,
    hspawn_,
    hspawn_,
    empty__,
    empty__,
    hbound_,
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
    spawn__,
    spawn__,
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
  id: "brokenHornBeasteel",
  name: "Broken-Horn Beasteel",
  width: 18,
  height: 22,
  locked: true,
  default: false,
  priority: [gridKey(1, 13, 18), gridKey(1, 12, 18), gridKey(1, 8, 18), gridKey(1, 7, 18), gridKey(5, 2, 18), gridKey(6, 2, 18), gridKey(10, 2, 18), gridKey(11, 2, 18), gridKey(16, 7, 18), gridKey(16, 8, 18), gridKey(16, 12, 18), gridKey(16, 13, 18), gridKey(11, 18, 18), gridKey(10, 18, 18), gridKey(6, 18, 18), gridKey(5, 18, 18)],
  tiles: [
    fcover_,
    fcover_,
    fcover_,
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
    fcover_,
    fcover_,
    fcover_,
    fcover_,
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
    spawn__,
    spawn__,
    empty__,
    empty__,
    empty__,
    spawn__,
    spawn__,
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
    empty__,
    hcover_,
    hcover_,
    hcover_,
    hcover_,
    hbound_,
    empty__,
    hcover_,
    hcover_,
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
    empty__,
    spawn__,
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
    spawn__,
    empty__,
    empty__,
    spawn__,
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
    spawn__,
    empty__,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    empty__,
    bosssub,
    bosssub,
    bosssub,
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
    hcover_,
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
    hcover_,
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
    bosssub,
    bosssub,
    bosssub,
    empty__,
    empty__,
    empty__,
    vbound_,
    vbound_,
    empty__,
    empty__,
    empty__,
    empty__,
    spawn__,
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
    spawn__,
    empty__,
    empty__,
    spawn__,
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
    hbound_,
    hcover_,
    hcover_,
    empty__,
    hcover_,
    hcover_,
    hcover_,
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
    spawn__,
    spawn__,
    empty__,
    empty__,
    empty__,
    spawn__,
    spawn__,
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
    fcover_,
    fcover_,
    fcover_,
    fcover_,
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
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    empty__,
    empty__,
    empty__,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_,
    fcover_
  ]
}, {
  id: "tuskBeasteel",
  name: "Tusk Beasteel",
  width: 21,
  height: 21,
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
  id: "bladeGuardTitan",
  name: "Blade Guard Titan",
  width: 16,
  height: 16,
  locked: true,
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
}];
function emptyMap(width, height) {
  return Array(width * height).fill(empty__);
}
function isBuiltInMap(name) {
  return maps.some((map) => map.name === name);
}
function builtInMaps() {
  return maps;
}
function findMap(name, customMap = state.customMap) {
  return maps.find((map) => map.name === name) ?? (customMap?.name === name ? customMap : void 0) ?? slots().find((map) => map?.name === name);
}
function isKnownMap(name, customMap) {
  return findMap(name, customMap) !== void 0;
}
function getMapByName(name, customMap) {
  const map = findMap(name, customMap);
  if (!map) throw new Error(`Map ${name} not found`);
  return map;
}
function getDefaultMap() {
  for (const map of maps) {
    if (map.default) {
      return map;
    }
  }
  return maps[0];
}
function loadMap(name) {
  const map = findMap(name);
  if (map) selectMap(map);
}
function selectMap(map) {
  const copy = isBuiltInMap(map.name) ? void 0 : toPlainMap(map);
  setState(
    produce((s) => {
      s.map = map.name;
      if (copy) s.customMap = copy;
      else delete s.customMap;
    })
  );
  fillGrid(map);
}
function toPlainMap(map) {
  return { id: map.id, name: map.name, width: map.width, height: map.height, priority: [...map.priority], tiles: [...map.tiles] };
}
function newMapId() {
  return `custom-${Math.random().toString(36).slice(2, 10)}`;
}
var [slotMaps, setSlotMaps] = createSignal(Array(MAP_SLOT_COUNT).fill(null));
var slots = slotMaps;
function slotLabel(index, map) {
  return `Slot ${index + 1}: ${map.name}`;
}
function mapChoices() {
  const choices = maps.map((map) => ({ label: map.name, map }));
  for (const [index, map] of slots().entries()) if (map) choices.push({ label: slotLabel(index, map), map });
  if (state.customMap && !isBuiltInMap(state.map) && timelineSlot() === -1) {
    choices.push({ label: timelineMapLabel(state.customMap), map: state.customMap });
  }
  return choices;
}
function timelineMapLabel(map) {
  return `This timeline: ${map.name}`;
}
function currentMapLabel() {
  if (isBuiltInMap(state.map) || !state.customMap) return state.map;
  const index = timelineSlot();
  const slot = index > -1 ? slots()[index] : null;
  return slot ? slotLabel(index, slot) : timelineMapLabel(state.customMap);
}
function loadSlots() {
  const stored = localStorageLoad(CUSTOM_MAP_SLOTS_KEY);
  const list = Array.from({ length: MAP_SLOT_COUNT }, (_, i) => {
    const raw = Array.isArray(stored) ? stored[i] : null;
    if (raw == null) return null;
    try {
      return checkMap(raw);
    } catch (e) {
      log.warn(`Custom map slot ${i + 1} couldn't be read, so it was left empty`, e);
      return null;
    }
  });
  if (!list.some((map) => map !== null)) {
    const legacy = localStorageLoad(V7_EDITOR_MAP_KEY);
    if (legacy != null) {
      try {
        const map = checkMap(legacy);
        map.id = newMapId();
        map.name = uniqueMapName(map.name, list);
        list[0] = map;
        localStorage.setItem(CUSTOM_MAP_SLOTS_KEY, JSON.stringify(list));
      } catch (e) {
        log.warn("The old custom map couldn't be read, so it wasn't moved into a slot", e);
      }
    }
  }
  setSlotMaps(list);
}
function saveSlot(index, map) {
  const copy = toPlainMap(map);
  const list = [...slots()];
  list[index] = copy;
  setSlotMaps(list);
  localStorage.setItem(CUSTOM_MAP_SLOTS_KEY, JSON.stringify(list));
  if (state.customMap?.id === copy.id && !isBuiltInMap(state.map)) {
    setState(
      produce((s) => {
        s.map = copy.name;
        s.customMap = toPlainMap(copy);
      })
    );
    saveToLocalStorage();
  }
}
function clearSlot(index) {
  const list = [...slots()];
  list[index] = null;
  setSlotMaps(list);
  localStorage.setItem(CUSTOM_MAP_SLOTS_KEY, JSON.stringify(list));
}
function timelineSlot() {
  const id = state.customMap?.id;
  if (id === void 0 || isBuiltInMap(state.map)) return -1;
  return slots().findIndex((map) => map?.id === id);
}
function mapNameProblem(name, index) {
  const trimmed = name.trim();
  if (!trimmed) return "Give the map a name";
  if (trimmed.length > 40) return "Keep the name to 40 characters or fewer";
  if (isBuiltInMap(trimmed)) return `"${trimmed}" is already a built-in map`;
  if (slots().some((map, i) => i !== index && map?.name === trimmed)) return `Another slot already has a map called "${trimmed}"`;
  return null;
}
function uniqueMapName(name, others = slots(), skip = -1) {
  const base = name.trim().slice(0, 36) || "Custom Map";
  const taken = (candidate) => isBuiltInMap(candidate) || others.some((map, i) => i !== skip && map?.name === candidate);
  if (!taken(base)) return base;
  let n = 2;
  while (taken(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
var [editingSlot, setEditingSlot] = createSignal(null);
function newBlank(name, width, height) {
  return { id: newMapId(), name: name.trim(), width, height, priority: [], tiles: emptyMap(width, height) };
}
function copyFrom(map, name) {
  return { ...toPlainMap(map), id: newMapId(), name: name.trim() };
}
function exportJson(map = mapGrid) {
  return JSON.stringify(toPlainMap(map), null, 0);
}
function parseMapJson(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That isn't valid JSON");
  }
  const map = checkMap(raw);
  map.id = newMapId();
  return map;
}
var ALL_TILE_BITS = 127;
function checkMap(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("That isn't a map");
  const data = raw;
  const { width, height, tiles, priority } = data;
  const isSize = (n) => typeof n === "number" && Number.isInteger(n) && n >= MIN_MAP_SIZE && n <= MAX_MAP_SIZE;
  if (!isSize(width) || !isSize(height)) {
    throw new Error(`"width" and "height" must be whole numbers from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}`);
  }
  if (!Array.isArray(tiles) || tiles.length !== width * height) {
    throw new Error(`"tiles" must list ${width * height} tiles (width \xD7 height)`);
  }
  const isTile = (tile) => typeof tile === "number" && Number.isInteger(tile) && tile >= 0 && tile <= ALL_TILE_BITS;
  if (!tiles.every(isTile)) throw new Error(`"tiles" has an unknown tile type`);
  const typed = tiles;
  if (typed.filter((tile) => isTileType(tile, 64 /* BossOrigin */)).length > 1) throw new Error("A map can only have one boss");
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 40) : "Custom Map";
  const ranks = Array.isArray(priority) ? priority : [];
  const cleanPriority = ranks.filter(
    (index, i) => typeof index === "number" && Number.isInteger(index) && index >= 0 && index < typed.length && isTileType(typed[index], 1 /* Spawn */) && ranks.indexOf(index) === i
  );
  const id = typeof data.id === "string" && data.id ? data.id : newMapId();
  return { id, name, width, height, priority: cleanPriority, tiles: [...typed] };
}

// src/store/keys.ts
var keyMapping = KEY_SLOTS;
function maxKeyHolders(key) {
  const extra = EXTRA_KEY_COPIES[key.type];
  return extra === void 0 ? void 0 : 1 + extra;
}
function keyHolders(team, keyId) {
  return team.filter((sd) => !sd.borrow && sd.keys.includes(keyId)).map((sd) => sd.id);
}
function displaySmallKeys(selectedDoll3) {
  const blankCommonKey = { type: 2 /* CommonKey */, rarity: 1 /* ExquisiteCurios */ };
  const blankFixedKey = { type: 1 /* FixedKey */, rarity: 1 /* ExquisiteCurios */ };
  const doll = getSelectedDoll(selectedDoll3);
  const result = [];
  const sortedKeys = sortDisplayEquippedKeys(selectedDoll3);
  for (const [index, keyType] of keyMapping.entries()) {
    const keyInfo = sortedKeys[index];
    if (keyType === 3 /* ExpansionKey */) result.push("=");
    if (!hasExpansionKey(doll) && keyType === 3 /* ExpansionKey */) continue;
    if (keyInfo === null) {
      if (keyType === 1 /* FixedKey */ || keyType === 3 /* ExpansionKey */) result.push(blankFixedKey);
      else if (keyType === 2 /* CommonKey */ || keyType === 4 /* AffinityKey */) result.push(blankCommonKey);
    } else {
      result.push(keyInfo);
    }
    if (keyType === 4 /* AffinityKey */) result.push("=");
  }
  return result;
}
function sortEquippedKeys(selectedDoll3) {
  const result = Array(keyMapping.length).fill("");
  const doll = getSelectedDoll(selectedDoll3);
  let fixedKeyIndex = keyMapping.indexOf(1 /* FixedKey */);
  let commonKeyIndex = keyMapping.indexOf(2 /* CommonKey */);
  const expansionKeyIndex = keyMapping.indexOf(3 /* ExpansionKey */);
  const affinityKeyIndex = keyMapping.indexOf(4 /* AffinityKey */);
  for (const [index, _keyType] of keyMapping.entries()) {
    const keyId = selectedDoll3.keys[index] ?? "";
    if (keyId === "") {
      continue;
    }
    if (!isRenderable({ kind: "dollKey" /* DollKey */, dollId: selectedDoll3.id, keyId })) continue;
    const keyInfo = getKeyById(keyId);
    if (keyInfo.type === 1 /* FixedKey */) {
      result[fixedKeyIndex] = keyId;
      fixedKeyIndex += 1;
      continue;
    } else if (keyInfo.type === 2 /* CommonKey */) {
      result[commonKeyIndex] = keyId;
      commonKeyIndex += 1;
      continue;
    } else if (keyInfo.type === 4 /* AffinityKey */) {
      result[affinityKeyIndex] = keyId;
      continue;
    } else if (keyInfo.type === 3 /* ExpansionKey */) {
      result[expansionKeyIndex] = keyId;
      continue;
    } else {
      log.error(`${doll.name}'s key "${keyInfo.name}" (${keyId}) has an unknown key type (${String(keyInfo.type)})`);
    }
  }
  return result;
}
function getPreSortedKeyInfo(selectedDoll3, keys) {
  const result = Array(keyMapping.length).fill(null);
  const doll = getSelectedDoll(selectedDoll3);
  for (const [index, keyId] of keys.entries()) {
    if (keyId === "") {
      continue;
    }
    if (!isRenderable({ kind: "dollKey" /* DollKey */, dollId: selectedDoll3.id, keyId })) continue;
    const keyInfo = getKeyById(keyId);
    if (keyInfo) {
      result[index] = keyInfo;
    } else {
      log.error(`${doll.name} has an unknown key "${keyId}"`);
    }
  }
  return result;
}
function sortDisplayEquippedKeys(selectedDoll3) {
  const result = Array(keyMapping.length).fill(null);
  const doll = getSelectedDoll(selectedDoll3);
  let fixedKeyIndex = keyMapping.indexOf(1 /* FixedKey */);
  let commonKeyIndex = keyMapping.indexOf(2 /* CommonKey */);
  const expansionKeyIndex = keyMapping.indexOf(3 /* ExpansionKey */);
  const affinityKeyIndex = keyMapping.indexOf(4 /* AffinityKey */);
  for (const [index, _keyType] of keyMapping.entries()) {
    const keyId = selectedDoll3.keys[index] ?? "";
    if (keyId === "") {
      continue;
    }
    if (!isRenderable({ kind: "dollKey" /* DollKey */, dollId: selectedDoll3.id, keyId })) continue;
    const keyInfo = getKeyById(keyId);
    if (keyInfo.type === 1 /* FixedKey */) {
      result[fixedKeyIndex] = keyInfo;
      fixedKeyIndex += 1;
      continue;
    } else if (keyInfo.type === 2 /* CommonKey */) {
      result[commonKeyIndex] = keyInfo;
      commonKeyIndex += 1;
      continue;
    } else if (keyInfo.type === 4 /* AffinityKey */) {
      result[affinityKeyIndex] = keyInfo;
      continue;
    } else if (keyInfo.type === 3 /* ExpansionKey */) {
      result[expansionKeyIndex] = keyInfo;
      continue;
    } else {
      log.error(`${doll.name}'s key "${keyInfo.name}" (${keyId}) has an unknown key type (${String(keyInfo.type)})`);
    }
  }
  return result;
}

// src/store/validation.ts
function dollName(id) {
  return getDollById(id).name;
}
function keyName(id) {
  const key = getKeyById(id);
  const ownerId = getKeyOwnerId(id);
  const sameName = ownerId && getDollById(ownerId).keys.some((other) => other.id !== id && other.type === key.type && other.name === key.name);
  return `${KeyTypeLabels[key.type]} "${key.name}"${sameName && key.number !== null ? ` Lv. ${key.number}` : ""}`;
}
function needsText(keys, fortification) {
  const parts = keys.map((keyId) => `equip ${keyName(keyId)}`);
  if (fortification) parts.push(`be at least V${fortification}`);
  return parts.join(" and ");
}
function checkEntity(id, location2, ctx3) {
  if (hasPrefix(id, "d" /* Dolls */)) {
    const doll2 = ctx3.resolved.get(id);
    if (doll2) return { ok: true, entity: doll2 };
    return {
      ok: false,
      error: {
        code: "ownerNotSelected" /* OwnerNotSelected */,
        renderable: false,
        reason: `${dollName(id)} is not in the team`,
        fixes: [
          { kind: "selectDoll" /* SelectDoll */, dollId: id },
          { kind: "removeEntry" /* RemoveEntry */, location: location2 }
        ]
      }
    };
  }
  if (!isKnownSummonId(id)) {
    return {
      ok: false,
      error: {
        code: "unknownId" /* UnknownId */,
        renderable: false,
        reason: `Unknown doll or summon "${String(id)}"`,
        fixes: [{ kind: "removeEntry" /* RemoveEntry */, location: location2 }]
      }
    };
  }
  const requirement = getSummonRequirement(id);
  const ownerId = getSummonOwnerId(id);
  const doll = ctx3.resolved.get(ownerId);
  if (!doll) {
    return {
      ok: false,
      error: {
        code: "ownerNotSelected" /* OwnerNotSelected */,
        renderable: false,
        reason: `${requirement.name} needs ${dollName(ownerId)}, who is not in the team`,
        fixes: [
          { kind: "selectDoll" /* SelectDoll */, dollId: ownerId },
          { kind: "removeEntry" /* RemoveEntry */, location: location2 }
        ]
      }
    };
  }
  if (!hasSummonFamily(id, doll)) {
    const keyId = requirement.requiresKey;
    if (keyId && !ctx3.selected.get(ownerId)?.keys.includes(keyId)) {
      return {
        ok: false,
        error: {
          code: "missingKey" /* MissingKey */,
          renderable: false,
          reason: `${requirement.name} needs ${doll.name} to ${needsText([keyId], void 0)}`,
          fixes: [
            { kind: "equipKey" /* EquipKey */, dollId: ownerId, keyId },
            { kind: "removeEntry" /* RemoveEntry */, location: location2 }
          ]
        }
      };
    }
    return {
      ok: false,
      error: {
        code: "unknownId" /* UnknownId */,
        renderable: false,
        reason: `${doll.name} has no summon "${requirement.name}"`,
        fixes: [{ kind: "removeEntry" /* RemoveEntry */, location: location2 }]
      }
    };
  }
  const summon = resolveSummon2(id, doll);
  if (summon.id !== id) {
    return {
      ok: false,
      resolved: summon,
      error: {
        code: "staleTier" /* StaleTier */,
        renderable: true,
        reason: `${summon.name} doesn't match ${doll.name}'s current loadout`,
        fixes: [{ kind: "replaceId" /* ReplaceId */, location: location2, from: id, to: summon.id }]
      }
    };
  }
  return { ok: true, entity: summon };
}
function checkSummonUnlocked(id, summon, location2, ctx3) {
  const dollId = getSummonOwnerId(id);
  const sd = ctx3.selected.get(dollId);
  if (!sd || isSummonUnlocked(summon, sd)) return null;
  const needs = getPlayableRequirement(id);
  const missingKeys = needs.keys.filter((keyId) => !sd.keys.includes(keyId));
  const missingFortification = needs.minFortification && sd.fortification < needs.minFortification ? needs.minFortification : void 0;
  const fixes = missingKeys.map((keyId) => ({ kind: "equipKey" /* EquipKey */, dollId, keyId }));
  if (missingFortification) fixes.push({ kind: "setFortification" /* SetFortification */, dollId, fortification: missingFortification });
  const reason = fixes.length ? `${summon.name} can't be controlled: ${dollName(dollId)} needs to ${needsText(missingKeys, missingFortification)}` : `${summon.name} can't be controlled with ${dollName(dollId)}'s current loadout`;
  return { code: "notPlayable" /* NotPlayable */, renderable: true, reason, fixes: [...fixes, { kind: "removeEntry" /* RemoveEntry */, location: location2 }] };
}
function checkSummonFielded(id, summon, location2, ctx3) {
  const dollId = getSummonOwnerId(id);
  const sd = ctx3.selected.get(dollId);
  const keyId = sd ? missingSummonKey(summon, sd) : void 0;
  if (!keyId) return null;
  return {
    code: "missingKey" /* MissingKey */,
    renderable: true,
    reason: `${summon.name} is on the map, but needs ${dollName(dollId)} to ${needsText([keyId], void 0)}`,
    fixes: [
      { kind: "equipKey" /* EquipKey */, dollId, keyId },
      { kind: "removeEntry" /* RemoveEntry */, location: location2 }
    ]
  };
}
function ownerDollId(entity) {
  return hasPrefix(entity.id, "d" /* Dolls */) ? entity.id : getSummonOwnerId(entity.id);
}
function checkSkill(skillId, owner, location2, ctx3) {
  if (skillId === V9_END_TURN_SKILL_ID) return null;
  const remove = { kind: "removeEntry" /* RemoveEntry */, location: location2 };
  if (!isKnownSkillId(skillId))
    return {
      code: "unknownId" /* UnknownId */,
      renderable: false,
      reason: `${owner.name} has an unknown skill "${String(skillId)}"`,
      fixes: [remove]
    };
  const requirement = getSkillRequirement(skillId);
  const ownerBase2 = hasPrefix(owner.id, "m" /* Summons */) ? summonBaseIdOf(owner.id) : owner.id;
  if (requirement.ownerId !== ownerBase2) {
    return {
      code: "unknownId" /* UnknownId */,
      renderable: false,
      reason: `"${requirement.name}" is not one of ${owner.name}'s skills`,
      fixes: [remove]
    };
  }
  const dollId = ownerDollId(owner);
  const sd = ctx3.selected.get(dollId);
  const missing = (keyId, fortification) => ({
    keys: keyId && !sd?.keys.includes(keyId) ? [keyId] : [],
    fortification: fortification && fortification > (sd?.fortification ?? 0) ? fortification : void 0
  });
  const loadoutFixes = (needs2) => [
    ...needs2.keys.map((keyId) => ({ kind: "equipKey" /* EquipKey */, dollId, keyId })),
    ...needs2.fortification ? [{ kind: "setFortification" /* SetFortification */, dollId, fortification: needs2.fortification }] : []
  ];
  if (hasSkillFamily(skillId, owner)) {
    const skill = resolveSkill2(skillId, owner);
    if (skill.id === skillId) return null;
    const replace = { kind: "replaceId" /* ReplaceId */, location: location2, from: skillId, to: skill.id };
    const tier = getSkillTier(skillId);
    const needs2 = missing(tier.keyId, tier.fortification);
    const fixes2 = loadoutFixes(needs2);
    if (fixes2.length) {
      return {
        code: needs2.keys.length ? "missingKey" /* MissingKey */ : "fortificationTooLow" /* FortificationTooLow */,
        renderable: true,
        reason: `${owner.name}'s "${skill.name}" was recorded with upgrades that need ${dollName(dollId)} to ${needsText(needs2.keys, needs2.fortification)}`,
        fixes: [...fixes2, replace, remove]
      };
    }
    return {
      code: "staleTier" /* StaleTier */,
      renderable: true,
      reason: `${owner.name}'s "${skill.name}" doesn't match ${dollName(dollId)}'s current loadout`,
      fixes: [replace]
    };
  }
  const needs = missing(requirement.requiresKey, requirement.minFortification);
  const fixes = loadoutFixes(needs);
  if (!fixes.length) {
    return {
      code: "unknownId" /* UnknownId */,
      renderable: false,
      reason: `${owner.name} doesn't have the skill "${requirement.name}"`,
      fixes: [remove]
    };
  }
  return {
    code: needs.keys.length ? "missingKey" /* MissingKey */ : "fortificationTooLow" /* FortificationTooLow */,
    // the skill isn't on the loadout at all, so the finders can't resolve it
    renderable: false,
    reason: `${owner.name}'s "${requirement.name}" needs ${dollName(dollId)} to ${needsText(needs.keys, needs.fortification)}`,
    fixes: [...fixes, remove]
  };
}
function isOnMap(id, tab) {
  if (hasPrefix(id, "d" /* Dolls */)) return (tab.dollPositions[id]?.x ?? -1) > -1;
  const base = summonBaseIdOf(id);
  return tab.summonPositions.some((p) => summonBaseIdOf(p.id) === base);
}
function copyPositionFix(save, id, tab) {
  for (let fromTab = tab - 1; fromTab >= 0; fromTab--) {
    if (isOnMap(id, save.tabData[fromTab])) return [{ kind: "copyPosition" /* CopyPosition */, id, tab, fromTab }];
  }
  return [];
}
function entityName(id) {
  if (hasPrefix(id, "d" /* Dolls */)) return dollName(id);
  return isKnownSummonId(id) ? getSummonRequirement(id).name : id;
}
function describeSkill(skillId, owner) {
  if (skillId === V9_END_TURN_SKILL_ID) return SkillTypeLabels[13 /* EndTurn */];
  if (!isKnownSkillId(skillId)) return String(skillId);
  if (!hasSkillFamily(skillId, owner)) return `"${getSkillRequirement(skillId).name}"`;
  const skill = resolveSkill2(skillId, owner);
  const selects = skill.selects.map((s) => SkillSelectLabels[s]).join("/");
  return `${SkillTypeLabels[skill.type]} "${skill.name}"${selects ? ` (targets ${selects})` : ""}`;
}
function resolvedSkill(skillId, owner) {
  if (skillId === V9_END_TURN_SKILL_ID || !isKnownSkillId(skillId) || !hasSkillFamily(skillId, owner)) return void 0;
  return resolveSkill2(skillId, owner);
}
function retargetFixes(location2) {
  return [
    { kind: "chooseTarget" /* ChooseTarget */, location: location2 },
    { kind: "removeEntry" /* RemoveEntry */, location: location2 }
  ];
}
function invalidTargetReason(action, targetId, error) {
  if (error.code === "ownerNotSelected" /* OwnerNotSelected */) {
    if (hasPrefix(targetId, "d" /* Dolls */)) return `${action} targets ${dollName(targetId)}, who is not in the team`;
    return `${action} targets ${entityName(targetId)}, but its owner ${dollName(getSummonOwnerId(targetId))} is not in the team`;
  }
  return `${action} can't target ${entityName(targetId)}: ${error.reason}`;
}
function checkTimeline(save, report) {
  const location2 = { kind: "timeline" /* Timeline */ };
  if (!save.selectedDolls.length) {
    report(location2, { code: "emptyTimeline" /* EmptyTimeline */, renderable: true, reason: "The team is empty", fixes: [] });
  } else if (!save.tabData.some((tab) => Object.values(tab.actions).some((actions) => actions.length))) {
    report(location2, { code: "emptyTimeline" /* EmptyTimeline */, renderable: true, reason: "No actions are recorded", fixes: [] });
  }
}
function checkBuffs(save, report) {
  for (const buffId of save.buffs) {
    if (isKnownBuffId(buffId)) continue;
    const location2 = { kind: "buff" /* Buff */, buffId };
    report(location2, {
      code: "unknownBuff" /* UnknownBuff */,
      renderable: false,
      reason: `Unknown seasonal buff "${String(buffId)}"`,
      fixes: [{ kind: "removeEntry" /* RemoveEntry */, location: location2 }]
    });
  }
}
function checkMap2(save, report) {
  if (isKnownMap(save.map, save.customMap)) return getMapByName(save.map, save.customMap);
  report(
    { kind: "map" /* Map */ },
    {
      code: "unknownMap" /* UnknownMap */,
      renderable: true,
      reason: `Unknown map "${save.map}"`,
      fixes: [{ kind: "setMap" /* SetMap */, map: getDefaultMap().name }]
    }
  );
  return void 0;
}
function closestLevel(levels, value) {
  const target = Number.isFinite(value) ? value : levels[0];
  return levels.reduce((best, candidate) => Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best);
}
function checkTeam(save, ctx3, report) {
  for (const sd of save.selectedDolls) {
    const doll = ctx3.resolved.get(sd.id);
    if (!doll) continue;
    const dollLocation = { kind: "doll" /* Doll */, dollId: sd.id };
    const invalid = (location2, renderable, reason, fixes) => {
      report(location2, { code: "invalidLoadout" /* InvalidLoadout */, renderable, reason, fixes });
    };
    if (!FORTIFICATION_LEVELS.includes(sd.fortification)) {
      invalid(dollLocation, true, `${doll.name} has an invalid fortification (V${sd.fortification})`, [
        { kind: "setFortification" /* SetFortification */, dollId: sd.id, fortification: closestLevel(FORTIFICATION_LEVELS, sd.fortification) }
      ]);
    }
    if (!REMOLDING_LEVELS.includes(sd.remoldingLvl)) {
      invalid(dollLocation, true, `${doll.name} has an invalid remolding level (${sd.remoldingLvl})`, [
        { kind: "setRemolding" /* SetRemolding */, dollId: sd.id, level: closestLevel(REMOLDING_LEVELS, sd.remoldingLvl) }
      ]);
    }
    const weaponLocation = { kind: "dollWeapon" /* DollWeapon */, dollId: sd.id };
    const signatureWeapon = { kind: "setWeapon" /* SetWeapon */, dollId: sd.id, weaponId: getWeaponByDollId(sd.id).id };
    if (!isKnownWeaponId(sd.gun)) {
      invalid(weaponLocation, false, `${doll.name} has an unknown weapon "${String(sd.gun)}"`, [signatureWeapon]);
    } else {
      const weapon = getWeaponById(sd.gun);
      if (weapon.gunType !== doll.gunType) {
        const reason = `${doll.name} uses ${GunTypeLabels[doll.gunType]} weapons, but has the ${GunTypeLabels[weapon.gunType]} "${weapon.name}" equipped`;
        invalid(weaponLocation, true, reason, [signatureWeapon]);
      }
    }
    const slots2 = /* @__PURE__ */ new Map();
    for (const type of KEY_SLOTS) {
      if (type === 3 /* ExpansionKey */ && !hasExpansionKey(doll)) continue;
      slots2.set(type, (slots2.get(type) ?? 0) + 1);
    }
    const used = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    for (const keyId of sd.keys) {
      if (keyId === "") continue;
      const location2 = { kind: "dollKey" /* DollKey */, dollId: sd.id, keyId };
      const unequip = { kind: "unequipKey" /* UnequipKey */, dollId: sd.id, keyId };
      if (!isKnownKeyId(keyId)) {
        invalid(location2, false, `${doll.name} has an unknown key "${String(keyId)}"`, [unequip]);
        continue;
      }
      const key = getKeyById(keyId);
      if (seen.has(keyId)) {
        invalid(location2, true, `${doll.name} has ${keyName(keyId)} equipped twice`, [unequip]);
        continue;
      }
      seen.add(keyId);
      const ownerId = getKeyOwnerId(keyId);
      if (ownerId && ownerId !== sd.id) {
        invalid(location2, true, `${keyName(keyId)} belongs to ${dollName(ownerId)}, not ${doll.name}`, [unequip]);
        continue;
      }
      const count = (used.get(key.type) ?? 0) + 1;
      used.set(key.type, count);
      const limit = slots2.get(key.type) ?? 0;
      if (count > limit) {
        const type = KeyTypeLabels[key.type];
        const reason = limit ? `${doll.name} has only ${limit} ${type} slot${limit === 1 ? "" : "s"}, so "${key.name}" doesn't fit` : `${doll.name} has no ${type} slot for "${key.name}"`;
        invalid(location2, true, reason, [unequip]);
      }
    }
  }
  checkSharedKeys(save, ctx3, report);
  const borrowed = save.selectedDolls.filter((sd) => sd.borrow && ctx3.resolved.has(sd.id));
  if (borrowed.length > 1) {
    const reason = "More than one doll is set as borrowed, please pick one";
    const fixes = borrowed.map((sd) => ({ kind: "setBorrow" /* SetBorrow */, dollId: sd.id, borrow: true }));
    for (const sd of borrowed) {
      report({ kind: "doll" /* Doll */, dollId: sd.id }, { code: "multipleBorrowed" /* MultipleBorrowed */, renderable: true, reason, fixes });
    }
  }
}
function joinNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
}
function checkSharedKeys(save, ctx3, report) {
  const team = save.selectedDolls.filter((sd) => ctx3.resolved.get(sd.id));
  const anyBorrowed = team.some((sd) => sd.borrow);
  const keyIds = new Set(team.flatMap((sd) => sd.keys.filter((keyId) => keyId !== "" && isKnownKeyId(keyId))));
  for (const keyId of keyIds) {
    const max = maxKeyHolders(getKeyById(keyId));
    if (max === void 0) continue;
    const holders = keyHolders(team, keyId);
    if (holders.length <= max) continue;
    const canBorrow = !anyBorrowed && holders.length === max + 1;
    for (const dollId of holders) {
      const others = holders.filter((id) => id !== dollId);
      const reason = max === 1 ? `${keyName(keyId)} is already equipped on ${joinNames(others.map(dollName))}` : `${keyName(keyId)} is equipped on ${holders.length} dolls (${joinNames(holders.map(dollName))}), but only ${max} copies are allowed`;
      const fixes = [{ kind: "unequipKey" /* UnequipKey */, dollId, keyId }];
      if (canBorrow) {
        for (const id of [dollId, ...others]) fixes.push({ kind: "setBorrow" /* SetBorrow */, dollId: id, borrow: true });
      }
      report({ kind: "dollKey" /* DollKey */, dollId, keyId }, { code: "sharedKey" /* SharedKey */, renderable: true, reason, fixes });
    }
  }
}
var BLOCKING_TILES = [8 /* HalfCover */, 16 /* FullCover */, 32 /* BossCover */, 64 /* BossOrigin */];
function occupiedCells(tab, map) {
  const cells = /* @__PURE__ */ new Set();
  for (const position of Object.values(tab.dollPositions)) {
    if (position.x > -1 && position.y > -1) cells.add(gridKey(position.x, position.y, map.width));
  }
  for (const position of tab.summonPositions) cells.add(gridKey(position.x, position.y, map.width));
  return cells;
}
function isFreeCell(map, occupied, cell) {
  const tile = map.tiles[cell] ?? 0 /* Empty */;
  return cell >= 0 && cell < map.width * map.height && !occupied.has(cell) && !BLOCKING_TILES.some((type) => isTileType(tile, type));
}
function spawnFix(save, map, dollId) {
  const occupied = occupiedCells(save.tabData[0], map);
  const isFreeSpawn = (cell2) => isFreeCell(map, occupied, cell2) && isTileType(map.tiles[cell2], 1 /* Spawn */);
  const ranked = map.priority.findIndex(isFreeSpawn);
  const cell = ranked > -1 ? map.priority[ranked] : map.tiles.findIndex((_, c) => isFreeSpawn(c));
  if (cell === void 0 || cell < 0) return [];
  const x = cell % map.width;
  const y = Math.floor(cell / map.width);
  return [{ kind: "placeAt" /* PlaceAt */, id: dollId, tab: 0, x, y, ...ranked > -1 ? { priority: ranked + 1 } : {} }];
}
function nearOwnerFix(save, map, summonId, tabIndex) {
  const tab = save.tabData[tabIndex];
  const ownerId = getSummonOwnerId(summonId);
  const owner = tab.dollPositions[ownerId];
  if (!owner || owner.x < 0 || owner.y < 0) return [];
  const occupied = occupiedCells(tab, map);
  let best;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!isFreeCell(map, occupied, gridKey(x, y, map.width))) continue;
      const dx = Math.abs(x - owner.x);
      const dy = Math.abs(y - owner.y);
      const steps = dx + dy;
      const reach = Math.max(dx, dy);
      if (!best || steps < best.steps || steps === best.steps && reach < best.reach) best = { x, y, steps, reach };
    }
  }
  return best ? [{ kind: "placeAt" /* PlaceAt */, id: summonId, tab: tabIndex, x: best.x, y: best.y, near: ownerId }] : [];
}
function checkPositions(save, map, report) {
  for (const [tabIndex, tab] of save.tabData.entries()) {
    const occupants = /* @__PURE__ */ new Map();
    const checkTile = (position, name, location2) => {
      const remove = { kind: "removeEntry" /* RemoveEntry */, location: location2 };
      if (position.x < 0 || position.y < 0 || position.x >= map.width || position.y >= map.height) {
        report(location2, {
          code: "invalidPosition" /* InvalidPosition */,
          renderable: true,
          reason: `${name} is outside the map`,
          fixes: [remove]
        });
        return;
      }
      const cell = gridKey(position.x, position.y, map.width);
      const tile = map.tiles[cell] ?? 0 /* Empty */;
      if (BLOCKING_TILES.some((type) => isTileType(tile, type))) {
        report(location2, {
          code: "invalidPosition" /* InvalidPosition */,
          renderable: true,
          reason: `${name} is on a blocked tile`,
          fixes: [remove]
        });
      } else if (tabIndex === 0 && location2.kind === "dollPosition" /* DollPosition */ && !isTileType(tile, 1 /* Spawn */)) {
        const place = spawnFix(save, map, location2.dollId);
        report(location2, {
          code: "invalidPosition" /* InvalidPosition */,
          renderable: true,
          reason: `${name} isn't on a spawn tile`,
          fixes: place.length ? place : [remove]
        });
      }
      const here = occupants.get(cell) ?? [];
      here.push({ name, location: location2, x: position.x, y: position.y });
      occupants.set(cell, here);
    };
    for (const sd of save.selectedDolls) {
      const location2 = { kind: "dollPosition" /* DollPosition */, tab: tabIndex, dollId: sd.id };
      const position = tab.dollPositions[sd.id];
      if (position && position.x > -1 && position.y > -1) {
        checkTile(position, entityName(sd.id), location2);
      } else if (tabIndex === 0) {
        report(location2, {
          code: "dollNotDeployed" /* DollNotDeployed */,
          renderable: true,
          reason: `${entityName(sd.id)} isn't placed on the map`,
          fixes: spawnFix(save, map, sd.id)
        });
      }
    }
    for (const [index, position] of tab.summonPositions.entries()) {
      const location2 = { kind: "summonPosition" /* SummonPosition */, tab: tabIndex, index };
      checkTile(position, entityName(position.id), location2);
    }
    for (const here of occupants.values()) {
      if (here.length < 2) continue;
      const names = here.map((occupant) => occupant.name);
      const reason = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} share a tile, please pick which one stays`;
      const fixes = here.map((occupant) => ({
        kind: "keepOnTile" /* KeepOnTile */,
        tab: tabIndex,
        x: occupant.x,
        y: occupant.y,
        keep: occupant.location
      }));
      for (const occupant of here) {
        report(occupant.location, { code: "overlappingPositions" /* OverlappingPositions */, renderable: true, reason, fixes });
      }
    }
  }
}
var LOADOUT_CODES = /* @__PURE__ */ new Set([
  "missingKey" /* MissingKey */,
  "fortificationTooLow" /* FortificationTooLow */,
  "notPlayable" /* NotPlayable */,
  "staleTier" /* StaleTier */,
  "ownerNotSelected" /* OwnerNotSelected */
]);
function turnPrefix(location2, code) {
  if (!("tab" in location2)) return "";
  if (LOADOUT_CODES.has(code) && location2.kind !== "actionTarget" /* ActionTarget */) return "";
  return location2.tab === 0 ? "Setup: " : `Turn ${location2.tab}: `;
}
function uniqueMessages(errors) {
  return [...new Set(errors.map((e) => e.message))];
}
function fixKey(fix) {
  if (fix.kind === "removeEntry" /* RemoveEntry */ || fix.kind === "chooseTarget" /* ChooseTarget */) return fix.kind;
  if (fix.kind === "replaceId" /* ReplaceId */) return `${fix.kind}:${fix.from}:${fix.to}`;
  return JSON.stringify(fix);
}
var AUTO_FIX_KINDS = /* @__PURE__ */ new Set([
  "equipKey" /* EquipKey */,
  "unequipKey" /* UnequipKey */,
  "setFortification" /* SetFortification */,
  "setWeapon" /* SetWeapon */,
  "setRemolding" /* SetRemolding */,
  "replaceId" /* ReplaceId */,
  "copyPosition" /* CopyPosition */,
  "placeAt" /* PlaceAt */
]);
function isAutoFix(fix) {
  return AUTO_FIX_KINDS.has(fix.kind);
}
function groupErrors(errors) {
  const groups = /* @__PURE__ */ new Map();
  for (const error of errors) {
    let group = groups.get(error.message);
    if (!group) {
      group = { message: error.message, reason: error.reason, errors: [], autoFixes: [], manualFixes: [], seen: /* @__PURE__ */ new Set() };
      groups.set(error.message, group);
    }
    group.errors.push(error);
    for (const fix of error.fixes) {
      const key = fixKey(fix);
      if (group.seen.has(key)) continue;
      group.seen.add(key);
      (isAutoFix(fix) ? group.autoFixes : group.manualFixes).push(fix);
    }
  }
  return [...groups.values()].map(({ seen: _seen, ...group }) => group);
}
var ISSUE_TYPE_RANK = {
  ["emptyTimeline" /* EmptyTimeline */]: 0,
  ["unknownMap" /* UnknownMap */]: 1,
  ["unknownBuff" /* UnknownBuff */]: 2,
  ["multipleBorrowed" /* MultipleBorrowed */]: 3,
  ["invalidLoadout" /* InvalidLoadout */]: 4,
  ["sharedKey" /* SharedKey */]: 5,
  ["ownerNotSelected" /* OwnerNotSelected */]: 6,
  ["unknownId" /* UnknownId */]: 7,
  ["missingKey" /* MissingKey */]: 8,
  ["fortificationTooLow" /* FortificationTooLow */]: 9,
  ["notPlayable" /* NotPlayable */]: 10,
  ["staleTier" /* StaleTier */]: 11,
  ["dollNotDeployed" /* DollNotDeployed */]: 12,
  ["invalidPosition" /* InvalidPosition */]: 13,
  ["overlappingPositions" /* OverlappingPositions */]: 14,
  ["actorNotOnMap" /* ActorNotOnMap */]: 15,
  ["missingTarget" /* MissingTarget */]: 16,
  ["targetNotOnMap" /* TargetNotOnMap */]: 17
};
function locationSubject(location2) {
  switch (location2.kind) {
    case "action" /* Action */:
    case "actionTarget" /* ActionTarget */:
    case "actionList" /* ActionList */:
      return location2.ownerId;
    case "actionOrder" /* ActionOrder */:
      return state.tabData[location2.tab]?.actionOrder[location2.index];
    case "summonPosition" /* SummonPosition */:
      return state.tabData[location2.tab]?.summonPositions[location2.index]?.id;
    case "dollPosition" /* DollPosition */:
    case "doll" /* Doll */:
    case "dollWeapon" /* DollWeapon */:
    case "dollKey" /* DollKey */:
      return location2.dollId;
    case "timeline" /* Timeline */:
    case "map" /* Map */:
    case "buff" /* Buff */:
      return void 0;
  }
}
function subjectName(id) {
  if (id === void 0) return "";
  if (hasPrefix(id, "d" /* Dolls */)) return combinedDolls.data[id]?.name ?? id;
  return entityName(id);
}
function issueSubject(group) {
  const id = locationSubject(group.errors[0].location);
  if (!id) return void 0;
  if (hasPrefix(id, "d" /* Dolls */)) {
    const doll = combinedDolls.data[id];
    return doll ? { name: doll.name, icon: doll.icons.avatar } : void 0;
  }
  const icon = getSummonIcon(id);
  return icon ? { name: entityName(id), icon } : void 0;
}
function sectionIssues(groups) {
  const GENERAL = -1;
  const sections = /* @__PURE__ */ new Map();
  for (const group of groups) {
    const tabs = new Set(group.errors.map((error) => "tab" in error.location ? error.location.tab : GENERAL));
    const key = tabs.size === 1 ? [...tabs][0] : GENERAL;
    const first = group.errors[0];
    const entries = sections.get(key) ?? [];
    entries.push({ group, rank: ISSUE_TYPE_RANK[first.code], name: subjectName(locationSubject(first.location)) });
    sections.set(key, entries);
  }
  return [...sections].sort(([a], [b]) => a - b).map(([key, entries]) => ({
    title: key === GENERAL ? "General" : key === 0 ? "Setup" : `Turn ${key}`,
    groups: entries.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name) || a.group.message.localeCompare(b.group.message)).map((entry) => entry.group)
  }));
}
function validateSave(save) {
  const ctx3 = {
    selected: new Map(save.selectedDolls.map((sd) => [sd.id, sd])),
    resolved: new Map(save.selectedDolls.map((sd) => [sd.id, getSelectedDoll(sd)]))
  };
  const errors = [];
  const report = (location2, error) => {
    const { reason, ...rest } = error;
    errors.push({ ...rest, location: location2, reason, message: turnPrefix(location2, error.code) + reason });
  };
  const push = (_tab, location2, error) => {
    report(location2, error);
  };
  checkTimeline(save, report);
  checkBuffs(save, report);
  checkTeam(save, ctx3, report);
  const map = checkMap2(save, report);
  if (map) checkPositions(save, map, report);
  for (const [tabIndex, tab] of save.tabData.entries()) {
    for (const [index, id] of tab.actionOrder.entries()) {
      const location2 = { kind: "actionOrder" /* ActionOrder */, tab: tabIndex, index };
      const check = checkEntity(id, location2, ctx3);
      if (!check.ok && (check.error.code === "ownerNotSelected" /* OwnerNotSelected */ || check.error.code === "unknownId" /* UnknownId */)) {
        push(tabIndex, location2, check.error);
      }
    }
    for (const [index, position] of tab.summonPositions.entries()) {
      const location2 = { kind: "summonPosition" /* SummonPosition */, tab: tabIndex, index };
      const check = checkEntity(position.id, location2, ctx3);
      if (!check.ok) push(tabIndex, location2, check.error);
      const summon = check.ok ? check.entity : check.resolved;
      const fieldError = summon && checkSummonFielded(position.id, summon, location2, ctx3);
      if (fieldError) push(tabIndex, location2, fieldError);
    }
    for (const [ownerKey, actions] of Object.entries(tab.actions)) {
      if (!actions.length) continue;
      const ownerId = ownerKey;
      const listLocation = { kind: "actionList" /* ActionList */, tab: tabIndex, ownerId };
      const owner = checkEntity(ownerId, listLocation, ctx3);
      if (!owner.ok) push(tabIndex, listLocation, owner.error);
      const ownerEntity = owner.ok ? owner.entity : owner.resolved;
      if (!ownerEntity) continue;
      if (hasPrefix(ownerId, "m" /* Summons */)) {
        if (!isEverPlayable(ownerId)) continue;
        const lockError = checkSummonUnlocked(ownerId, ownerEntity, listLocation, ctx3);
        if (lockError) push(tabIndex, listLocation, lockError);
      }
      if (!isOnMap(ownerId, tab)) {
        push(tabIndex, listLocation, {
          code: "actorNotOnMap" /* ActorNotOnMap */,
          renderable: true,
          reason: `${ownerEntity.name} has actions but is not on the map`,
          // a summon goes next to its owner first (the automatic fix), else where it stood on an earlier turn
          fixes: [
            ...map && hasPrefix(ownerId, "m" /* Summons */) ? nearOwnerFix(save, map, ownerId, tabIndex) : [],
            ...copyPositionFix(save, ownerId, tabIndex),
            { kind: "removeEntry" /* RemoveEntry */, location: listLocation }
          ]
        });
      }
      for (const [index, [skillId, targetId]] of actions.entries()) {
        const location2 = { kind: "action" /* Action */, tab: tabIndex, ownerId, index };
        const skillError = checkSkill(skillId, ownerEntity, location2, ctx3);
        if (skillError) push(tabIndex, location2, skillError);
        const skill = resolvedSkill(skillId, ownerEntity);
        const action = `${ownerEntity.name}'s ${describeSkill(skillId, ownerEntity)}`;
        if (targetId === void 0) {
          if (skill && needsAllyTarget(skill)) {
            push(tabIndex, location2, {
              code: "missingTarget" /* MissingTarget */,
              renderable: true,
              reason: `${action} has no target`,
              fixes: retargetFixes(location2)
            });
          }
          continue;
        }
        const targetLocation = { kind: "actionTarget" /* ActionTarget */, tab: tabIndex, ownerId, index };
        const removeTarget = { kind: "removeEntry" /* RemoveEntry */, location: targetLocation };
        const needsTarget = skill ? needsAllyTarget(skill) : true;
        const target = checkEntity(targetId, targetLocation, ctx3);
        if (!target.ok) {
          const fixes = needsTarget && target.error.code !== "staleTier" /* StaleTier */ ? [
            ...target.error.fixes.filter(
              (fix) => fix.kind !== "removeEntry" /* RemoveEntry */ && fix.kind !== "selectDoll" /* SelectDoll */
            ),
            ...retargetFixes(location2)
          ] : target.error.fixes;
          push(tabIndex, targetLocation, { ...target.error, fixes, reason: invalidTargetReason(action, targetId, target.error) });
        }
        const targetEntity = target.ok ? target.entity : target.resolved;
        if (targetEntity && !isOnMap(targetId, tab)) {
          push(tabIndex, targetLocation, {
            code: "targetNotOnMap" /* TargetNotOnMap */,
            renderable: true,
            reason: `${action} targets ${targetEntity.name}, who is not on the map`,
            // the target can be put back where it stood on an earlier turn, or another one picked
            fixes: [...copyPositionFix(save, targetId, tabIndex), ...needsTarget ? retargetFixes(location2) : [removeTarget]]
          });
        }
      }
    }
  }
  return errors;
}
function locationKey(location2) {
  const fields = location2;
  return [location2.kind, fields.tab, fields.ownerId, fields.index, fields.dollId, fields.keyId, fields.buffId].map((value) => String(value ?? "")).join(":");
}
function lazyMemo(fn) {
  let memo2;
  return () => {
    memo2 ?? (memo2 = createRoot(() => createMemo(fn)));
    return memo2();
  };
}
var saveErrors = lazyMemo(() => validateSave(state));
var saveIssueGroups = lazyMemo(() => groupErrors(saveErrors()));
var saveIssueSections = lazyMemo(() => sectionIssues(saveIssueGroups()));
var isShareable = () => saveErrors().length === 0;
var errorsByLocation = lazyMemo(() => {
  const map = /* @__PURE__ */ new Map();
  for (const error of saveErrors()) {
    const key = locationKey(error.location);
    map.set(key, [...map.get(key) ?? [], error]);
  }
  return map;
});
function getActionErrors(at) {
  const errors = errorsByLocation();
  return [
    ...errors.get(locationKey({ kind: "actionList" /* ActionList */, tab: at.tab, ownerId: at.ownerId })) ?? [],
    ...errors.get(locationKey({ kind: "action" /* Action */, ...at })) ?? [],
    ...errors.get(locationKey({ kind: "actionTarget" /* ActionTarget */, ...at })) ?? []
  ];
}
var unrenderable = lazyMemo(
  () => new Set(
    saveErrors().filter((e) => !e.renderable).map((e) => locationKey(e.location))
  )
);
function isRenderable(location2) {
  if (unrenderable().has(locationKey(location2))) return false;
  if (location2.kind === "action" /* Action */ || location2.kind === "actionTarget" /* ActionTarget */) {
    return !unrenderable().has(locationKey({ kind: "actionList" /* ActionList */, tab: location2.tab, ownerId: location2.ownerId }));
  }
  return true;
}

// src/canvas/dollGrid.ts
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
    const isMinHigherPriority = () => doll.priority < (minDoll?.priority ?? Infinity) || doll.borrow;
    const isMaxHigherPriority = () => doll.priority < (maxDoll?.priority ?? Infinity) || doll.borrow;
    if (dist < min || dist === min && isMinHigherPriority()) {
      min = dist;
      minDoll = doll;
    }
    if (dist > max || dist === max && isMaxHigherPriority()) {
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
    const spawnPosition = getDollStartingPosition(doll.id);
    const priorityIndex = mapGrid.priority.indexOf(spawnPosition);
    dolls.push({
      x: pos.x,
      y: pos.y,
      oldX: oldPos.x,
      oldY: oldPos.y,
      id: doll.id,
      instanceId: null,
      priority: priorityIndex !== -1 ? priorityIndex : mapGrid.priority.length,
      dollInfo: getSelectedDoll(doll),
      summonInfo: null,
      dragId: drag2?.isActive ? drag2.id : void 0,
      dragInstanceId: drag2?.isActive ? drag2.instanceId : null,
      obscured: obscured(pos.x, pos.y, doll.id, null),
      borrow: doll.borrow || false,
      distance: null
    });
  });
  if (currentTab >= 1) {
    state.tabData[currentTab].summonPositions.forEach((entry, index) => {
      if (!isRenderable({ kind: "summonPosition" /* SummonPosition */, tab: currentTab, index })) return;
      const summon = getSummonById(entry.id);
      const oldSummonPosition = state.tabData[currentTab - 1]?.summonPositions.find((e) => e.mapId === entry.mapId);
      dolls.push({
        x: entry.x,
        y: entry.y,
        oldX: oldSummonPosition?.x ?? -1,
        oldY: oldSummonPosition?.y ?? -1,
        id: entry.id,
        instanceId: entry.mapId,
        priority: mapGrid.priority.length,
        dollInfo: getDollByDollOrSummon(summon),
        summonInfo: summon,
        dragId: drag2?.isActive ? drag2.id : void 0,
        dragInstanceId: drag2?.isActive ? drag2.instanceId : null,
        obscured: obscured(entry.x, entry.y, entry.id, entry.mapId),
        borrow: false,
        distance: null
      });
    });
  }
  for (const [_grid, entry] of Object.entries(dolls)) {
    entry.obscured = obscured(entry.x, entry.y, entry.id, entry.instanceId, dolls);
  }
  distance(dolls);
  return dolls;
}

// src/canvas/drawEntities.ts
function drawDollOnCanvas(ctx3, data) {
  if (!data.dollInfo) return;
  const cx = Math.round(data.x * TILE_SIZE + TILE_SIZE / 2);
  const cy = Math.round(data.y * TILE_SIZE + TILE_SIZE / 2);
  const r = Math.round(TILE_SIZE * 0.475);
  const avatarOffY = Math.round(TILE_SIZE * 0.06);
  const image = getImageForEntity(data.id);
  if (image) {
    ctx3.save();
    if (hasPrefix(data.id, "m" /* Summons */) && data.instanceId === data.dragInstanceId || hasPrefix(data.id, "d" /* Dolls */) && data.id === data.dragId) {
      ctx3.globalAlpha = 0.25;
    }
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
    ctx3.clip();
    ctx3.imageSmoothingEnabled = true;
    ctx3.imageSmoothingQuality = "high";
    ctx3.drawImage(image, cx - r, cy - avatarOffY - r, r * 2, r * 2);
    ctx3.restore();
  }
  if (data.summonInfo) {
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r + 2, 0, Math.PI * 2);
    ctx3.strokeStyle = "#2dd4bf";
    ctx3.lineWidth = 2;
    ctx3.stroke();
    const immobileIcon2 = getImmobileIcon();
    if (immobileIcon2 && isInertSummon(data.summonInfo)) {
      const size = Math.round(r * 0.7);
      const edge = Math.round(r * Math.SQRT1_2);
      drawImmobileBadge(ctx3, immobileIcon2, cx + edge - size / 2, cy - avatarOffY + edge - size / 2, size);
    }
  }
}
function drawImmobileBadge(ctx3, icon, x, y, size) {
  ctx3.save();
  ctx3.fillStyle = "#3a4246";
  ctx3.beginPath();
  ctx3.roundRect(x, y, size, size, size * 0.1);
  ctx3.fill();
  const padding = size * 0.1;
  ctx3.imageSmoothingEnabled = true;
  ctx3.imageSmoothingQuality = "high";
  ctx3.drawImage(icon, x + padding, y + padding, size - padding * 2, size - padding * 2);
  ctx3.restore();
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
  const dollOrSummon = getEntityById(drag2.id);
  const image = getImageForEntity(drag2.id);
  let cx = Math.round(drag2.currentTileX * TILE_SIZE + TILE_SIZE / 2);
  let cy = Math.round(drag2.currentTileY * TILE_SIZE + TILE_SIZE / 2);
  if (drag2.status === 2 /* Swap */) {
    cx = Math.round(drag2.currentTileX * TILE_SIZE + TILE_SIZE / 4);
    cy = Math.round(drag2.currentTileY * TILE_SIZE + TILE_SIZE / 4);
  }
  const r = Math.round(TILE_SIZE * 0.475);
  const avatarOffY = Math.round(TILE_SIZE * 0.06);
  if (image) {
    ctx3.save();
    ctx3.globalAlpha = 0.6;
    ctx3.beginPath();
    ctx3.arc(cx, cy - avatarOffY, r, 0, Math.PI * 2);
    ctx3.clip();
    ctx3.imageSmoothingEnabled = true;
    ctx3.imageSmoothingQuality = "high";
    ctx3.drawImage(image, cx - r, cy - avatarOffY - r, r * 2, r * 2);
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
  const labelW = Math.ceil(ctx3.measureText(dollOrSummon.name).width) + 4;
  ctx3.fillStyle = "rgba(0,0,0,0.75)";
  ctx3.fillRect(Math.round(cx - labelW / 2), labelY, labelW, fontSize + 2);
  ctx3.fillStyle = "#ffffff";
  if (drag2.status === 2 /* Swap */) {
    ctx3.fillText("Swap", cx, labelY + 1);
  } else {
    ctx3.fillText(dollOrSummon.name, cx, labelY + 1);
  }
}

// src/canvas/drawTiles.ts
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
  const mapCoord = gridKey(c, r, mapGrid.width);
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
  if (priority === -1) return;
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

// src/canvas/draw.ts
function drawMapTilesOnArena(ctx3, drag2, currentTab) {
  const dolls = getDollData(drag2, currentTab);
  for (let row = 0; row < mapGrid.height; row++) for (let col = 0; col < mapGrid.width; col++) drawFloor(ctx3, col, row);
  for (let row = 0; row < mapGrid.height; row++) {
    for (let col = 0; col < mapGrid.width; col++) {
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
  for (let row = 0; row < mapGrid.height; row++) {
    for (let col = 0; col < mapGrid.width; col++) {
      const doll = dolls.find((doll2) => doll2.x === col && doll2.y === row);
      if (doll) {
        drawDollLabelOnCanvas(ctx3, doll);
      }
    }
  }
}

// src/components/icons/Discard.tsx
var _tmpl$9 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 30 30"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(0.923077,-9.42036e-19,1.11332e-18,-1.1,-7.61538,39.4)><path d=M22.333,24L22.333,29.909L26.667,29.909L26.667,24L31,24L24.5,19L18,24L22.333,24Z style=fill:rgb(235,235,235)></path></g><g transform=matrix(1,0,0,1,-9.5,-6.5)><path d=M37,30L12,30L12,20L15,20L15,27L34,27L34,20L37,20L37,30Z style=fill:rgb(235,235,235)>`);
function Discard() {
  return _tmpl$9();
}

// src/components/modals/Modal.tsx
var _tmpl$10 = /* @__PURE__ */ template(`<div class="mb-1.75 flex flex-col"><h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]"></h2><div class="mt-1.75 border-t-3 border-[#B5B5B6]">`);
var _tmpl$23 = /* @__PURE__ */ template(`<div><div class="flex h-full w-full flex-col overflow-hidden border-2 border-[#B1AFB3] px-1.5 py-1.75">`);
function Modal(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$23(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.title;
      },
      get children() {
        var _el$3 = _tmpl$10(), _el$4 = _el$3.firstChild;
        insert(_el$4, () => props.title);
        return _el$3;
      }
    }), null);
    insert(_el$2, resolved, null);
    createRenderEffect(() => className(_el$, `${props.width ?? "w-225"} ${props.hide ? "hidden" : ""} overflow-hidden rounded-sm border-4 border-[#CFCED2] bg-[#CFCED2] shadow-2xl`));
    return _el$;
  })();
}

// src/store/effects.ts
var buffRegex = new RegExp(`\\{(${"b" /* Buffs */}[0-9a-z]+)\\}`, "gi");
var interactiveStyles = (selected = false) => "cursor-pointer outline-3 transition transition-discrete duration-175 hover:scale-107 hover:outline-white " + (selected === true ? "outline-[#F26C1C]" : selected === null ? "outline-transparent" : "outline-transparent");
var rarityBorderColor = (rarity) => rarity === 3 /* Elite */ ? "border-[#DF9E00]" : rarity === 2 /* Standard */ ? "border-[#7968BA]" : "border-[#3291AB]";
var rarityGradientColor = (rarity) => rarity === 3 /* Elite */ ? "from-[#453824]" : rarity === 2 /* Standard */ ? "from-[#272B40]" : "from-[#133843]";
function getBuffName(id) {
  const buff = getBuffById(id);
  return buff.name;
}
var parseEffects = (description) => {
  return expandRichText(description).replace(buffRegex, (match, buffId) => {
    return `<span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]" data-effect-id="${buffId}">${getBuffName(buffId)}</span>`;
  });
};
function formatEffectDescription(description) {
  return description.replace(
    buffRegex,
    (match, id) => `<span class="font-semibold text-[#4FA8E8]">${getBuffName(id)}</span>`
  );
}
function getReferencedEffects(rootBuffId) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  const queue = [rootBuffId];
  while (queue.length) {
    const id = queue.shift();
    if (id === void 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const buff = getBuffById(id);
    result.push(buff);
    const regexMatch = [...buff.description.matchAll(buffRegex)];
    queue.push(...regexMatch.map((match) => match[1]));
  }
  return result;
}
function renderAction(action, at) {
  if (!isRenderable({ kind: "action" /* Action */, ...at })) return "?";
  const [skillId, targetId] = action;
  const skill = getSkillById(skillId);
  if (targetId) {
    if (!isRenderable({ kind: "actionTarget" /* ActionTarget */, ...at })) return getSkillDisplay(skill.type) + ">?";
    const target = getEntityById(targetId);
    return getSkillDisplay(skill.type) + ">" + (target?.name ?? "?");
  }
  return getSkillDisplay(skill.type);
}
function renderActionBySkill(skill) {
  return getSkillDisplay(skill.type);
}

// src/components/icons/Check.tsx
var _tmpl$11 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 36 36"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1.02012,0,0,1.00693,-245.655,-19.8612)><path d="M274.14,24.094L274.14,51.107C274.14,52.423 273.086,53.491 271.787,53.491L245.124,53.491C243.825,53.491 242.771,52.423 242.771,51.107L242.771,24.094C242.771,22.779 243.825,21.711 245.124,21.711L271.787,21.711C273.086,21.711 274.14,22.779 274.14,24.094Z"style=fill:white></path></g><g transform=matrix(1.04023,0,0,1.03759,-250.961,-20.8722)><rect x=245.1 y=23.971 width=26.917 height=26.986 style=fill:rgb(242,108,28)></rect></g><g transform=matrix(0.710508,0.710508,-0.626343,0.626343,-100.485,-124.002)><path d=M188.249,28.332L188.249,28.354L175.578,28.354L175.578,23.56L184.046,23.56L184.046,5.99L188.269,5.99L188.269,28.332L188.249,28.332Z style=fill:white>`);
function Check() {
  return _tmpl$11();
}

// src/components/icons/PhaseBurn.tsx
var _tmpl$12 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Burn><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(169,77,36)></path></g><g transform=matrix(0.9625,0,0,1.19355,1.75,-11.1935)><path d="M33.696,61.874C31.412,61.39 29.373,60.638 27.611,59.665C22.976,56.825 20,52.43 20,47.5C20,47.378 20.002,47.257 20.005,47.136L20,47.136C20.022,42.298 22.463,38.039 26.151,35.553L26.151,36.321L26.166,36.31L26.166,37.225C25.873,37.711 25.714,38.242 25.714,38.757C25.714,40.416 27.471,41.785 29.902,41.762C33.055,41.733 34.559,39.775 34.559,38.116C34.559,37.807 34.477,37.514 34.329,37.243L34.329,37.22C33.787,36.034 33.512,34.557 33.601,32.742C33.61,32.568 33.628,32.393 33.655,32.218L33.642,32.218C33.659,32.141 33.676,32.065 33.695,31.989C34.345,28.673 38.109,25.149 42.496,23.457C42.63,23.406 42.763,23.361 42.896,23.324C42.899,24.148 42.948,25.064 42.948,26.042C42.948,27.27 44.643,31.18 49.318,33.784C55.668,36.382 60,41.552 60,47.5C60,52.559 56.866,57.055 52.023,59.884C50.109,60.883 47.884,61.627 45.381,62.062C49.032,60.428 51.791,57.425 51.791,54.64C51.791,52.663 51.135,51.019 50.053,49.758L50.084,49.702L49.898,49.584C49.242,48.868 48.444,48.283 47.549,47.841C44.734,45.506 41.84,42.273 41.84,40.492C41.84,40.298 41.852,40.109 41.875,39.925C40.472,41.233 39.564,43.317 39.564,45.663C39.564,46.699 39.741,47.684 40.06,48.574C40.067,48.687 40.07,48.801 40.07,48.916C40.07,51.609 38.273,53.796 36.06,53.796C34.221,53.796 32.669,52.285 32.198,50.228C30.435,51.815 29.351,53.856 29.351,55.835C29.351,58.332 31.066,60.524 33.696,61.874Z"style=fill:rgb(228,102,41)>`);
function PhaseBurn() {
  return _tmpl$12();
}

// src/components/icons/PhaseCorrosion.tsx
var _tmpl$13 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Corrosion><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(96,85,189)></path></g><g><g transform=matrix(1.11111,0,0,1.25,-5.38889,-15.5)><ellipse cx=39.5 cy=58 rx=4.5 ry=4 style=fill:rgb(134,121,232)></ellipse></g><g transform=matrix(1.06667,0,0,1.23077,-4.13333,-11.2308)><ellipse cx=54.5 cy=46.5 rx=7.5 ry=6.5 style=fill:rgb(134,121,232)></ellipse></g><g transform=matrix(1.18182,0,0,1,-10.5455,1)><ellipse cx=52.5 cy=24.5 rx=5.5 ry=6.5 style=fill:rgb(134,121,232)></ellipse></g><g transform=matrix(0.884615,0,0,1.21053,4.34615,-7.68421)><ellipse cx=29 cy=36.5 rx=13 ry=9.5 style=fill:rgb(134,121,232)>`);
function PhaseCorrosion() {
  return _tmpl$13();
}

// src/components/icons/PhaseElectric.tsx
var _tmpl$14 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Electric><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(173,141,32)></path></g><path d=M50,17.5L33,17.5L25,46L42,42L34,64L58,33L40,36L50,17.5Z style=fill:rgb(235,191,33)>`);
function PhaseElectric() {
  return _tmpl$14();
}

// src/components/icons/PhaseFreeze.tsx
var _tmpl$15 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Freeze><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(48,151,166)></path></g><g><g transform=matrix(1,0,0,1.2,-2,-12.8)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(1,0,0,1.2,-2,-36.8)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(0.961538,0,0,1.13636,-0.865385,-6.02273)><ellipse cx=42.5 cy=40.5 rx=6.5 ry=5.5 style=fill:rgb(66,204,224)></ellipse></g><g transform=matrix(0.499153,0.866514,-1.03982,0.598984,85.5838,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(-0.499989,0.866032,-1.03924,-0.599987,127.511,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(-0.499153,0.866514,1.03982,0.598984,-5.78748,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)></path></g><g transform=matrix(0.499989,0.866032,1.03924,-0.599987,-47.7144,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z style=fill:rgb(66,204,224)>`);
function PhaseFreeze() {
  return _tmpl$15();
}

// src/components/icons/PhaseHydro.tsx
var _tmpl$16 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Corrosion><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(33,126,162)></path></g><g transform=matrix(1,0,0,1,2,-1.5)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"style=fill:rgb(43,168,216)></path></g><g transform=matrix(-1,0,0,-1,78.1114,81.5649)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"style=fill:rgb(43,168,216)>`);
function PhaseHydro() {
  return _tmpl$16();
}

// src/components/icons/PhaseOmni.tsx
var _tmpl$17 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Omni><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g><g transform=matrix(1.27442,0,0,1.099,-10.2998,-2.98897)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(-0.585385,1.02359,-0.954008,-0.545589,103.249,20.7405)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(0.517371,0.996336,0.97534,-0.506469,-9.83172,37.6917)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(1.13281,-1.73412e-17,1.49543e-17,-1.099,14.7335,84.989)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(-0.547687,0.991618,0.962018,0.531338,13.4075,-3.22855)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g><g transform=matrix(0.55516,1.00515,-0.962018,0.531338,56.4324,-22.5184)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z style=fill:rgb(223,22,76)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(227,41,85)>`);
function PhaseOmni() {
  return _tmpl$17();
}

// src/components/icons/PhasePhysical.tsx
var _tmpl$18 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=Physical><g opacity=0.75><g transform=matrix(0.904911,0,0,0.896962,2.02733,3.12225)><path d="M77.878,12.757L77.878,69.471C77.878,73.818 74.38,77.347 70.07,77.347L13.855,77.347C9.546,77.347 6.048,73.818 6.048,69.471L6.048,12.757C6.048,8.41 9.546,4.881 13.855,4.881L70.07,4.881C74.38,4.881 77.878,8.41 77.878,12.757Z"style=fill:rgb(32,33,34)></path></g></g><g transform=matrix(1.05805,0,0,1.04876,-4.35107,-3.11859)><path d="M77.878,16.433L77.878,65.795C77.878,72.171 72.747,77.347 66.427,77.347L17.499,77.347C11.179,77.347 6.048,72.171 6.048,65.795L6.048,16.433C6.048,10.057 11.179,4.881 17.499,4.881L66.427,4.881C72.747,4.881 77.878,10.057 77.878,16.433ZM72.635,16.862C72.635,13.144 69.642,10.125 65.957,10.125L17.878,10.125C14.193,10.125 11.201,13.144 11.201,16.862L11.201,65.366C11.201,69.085 14.193,72.103 17.878,72.103L65.957,72.103C69.642,72.103 72.635,69.085 72.635,65.366L72.635,16.862Z"style=fill:rgb(149,148,153)></path></g><g transform=matrix(1.5625,0,0,1.2973,-20.4375,-8.14865)><path d=M39,19L52.856,28.25L52.856,46.75L39,56L25.144,46.75L25.144,28.25L39,19ZM29.023,44.16L32.903,41.57L32.903,33.43L39,29.36L45.097,33.43L45.097,41.57L48.977,44.16L48.977,30.84L39,24.18L29.023,30.84L29.023,44.16Z style=fill:rgb(201,200,206)>`);
function PhasePhysical() {
  return _tmpl$18();
}

// src/components/icons/PhaseIcon.tsx
function PhaseIcon(props) {
  switch (props.phase) {
    default:
      return null;
    case 1 /* Physical */:
      return createComponent(PhasePhysical, {});
    case 2 /* Burn */:
      return createComponent(PhaseBurn, {});
    case 4 /* Electric */:
      return createComponent(PhaseElectric, {});
    case 5 /* Freeze */:
      return createComponent(PhaseFreeze, {});
    case 3 /* Corrosion */:
      return createComponent(PhaseCorrosion, {});
    case 6 /* Hydro */:
      return createComponent(PhaseHydro, {});
    case 7 /* Resonance */:
      return createComponent(PhaseOmni, {});
  }
}

// src/components/icons/UnreleasedBadge.tsx
var _tmpl$19 = /* @__PURE__ */ template(`<div title="Unreleased (CN only)">CN`);
function UnreleasedBadge(props) {
  return (() => {
    var _el$ = _tmpl$19();
    createRenderEffect(() => className(_el$, `pointer-events-none absolute rounded-sm bg-[#1E6FD9] px-1 leading-4 font-bold text-white ${props.class ?? "bottom-1 left-1 z-20 text-xs"}`));
    return _el$;
  })();
}

// src/components/icons/Alert.tsx
var _tmpl$20 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 16 16"xmlns=http://www.w3.org/2000/svg><path d="M8 1L15.5 14.5H0.5Z"style=fill:currentColor></path><path d="M7.1 5.5H8.9L8.6 10.5H7.4Z M7.1 11.6H8.9V13.2H7.1Z"style=fill:#1C2A32>`);
function Alert() {
  return _tmpl$20();
}

// src/components/SmallDollChip.tsx
var _tmpl$21 = /* @__PURE__ */ template(`<span class="gf-badge gf-badge-missing absolute -top-1 -right-1 z-30">`);
var _tmpl$24 = /* @__PURE__ */ template(`<span class="gf-badge gf-badge-inert pointer-events-auto absolute right-0.5 bottom-0.5 z-20"title="No skills: it can't move or act, it only occupies a tile">`);
var _tmpl$33 = /* @__PURE__ */ template(`<div><div><div><div class="absolute top-0.5 left-0.5 h-4 w-4"></div><img loading=lazy decoding=async width=56 height=56 class="h-(--small-chip-width) w-full object-cover object-top"></div><div>`, true, false, false);
var _tmpl$42 = /* @__PURE__ */ template(`<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">`);
function SmallDollChip(props) {
  const doll = getDollByDollOrSummon(props.target);
  const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
  const interactive = typeof props.onClick !== "undefined" || typeof props.onDragStart !== "undefined" || typeof props.onPointerDown !== "undefined";
  return (
    // the outer layer scales on hover and isn't clipped, so the alert can sit just past the chip's corner
    (() => {
      var _el$ = _tmpl$33(), _el$3 = _el$.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.nextSibling, _el$8 = _el$4.nextSibling;
      addEventListener(_el$, "pointerdown", props.onPointerDown, true);
      addEventListener(_el$, "dragstart", props.onDragStart);
      addEventListener(_el$, "click", props.onClick, true);
      insert(_el$, createComponent(Show, {
        get when() {
          return props.alert;
        },
        get children() {
          var _el$2 = _tmpl$21();
          insert(_el$2, createComponent(Alert, {}));
          return _el$2;
        }
      }), _el$3);
      insert(_el$4, (() => {
        var _c$ = memo(() => !!props.selected);
        return () => _c$() && (() => {
          var _el$9 = _tmpl$42();
          insert(_el$9, createComponent(Check, {}));
          return _el$9;
        })();
      })(), _el$5);
      insert(_el$5, createComponent(PhaseIcon, {
        get phase() {
          return doll.phase;
        }
      }));
      setAttribute(_el$6, "src", icon);
      insert(_el$4, createComponent(Show, {
        get when() {
          return isUnreleased(props.target);
        },
        get children() {
          return createComponent(UnreleasedBadge, {
            "class": "bottom-0.5 left-0.5 z-20 text-[10px]"
          });
        }
      }), null);
      insert(_el$4, createComponent(Show, {
        get when() {
          return isInertSummon(props.target);
        },
        get children() {
          var _el$7 = _tmpl$24();
          insert(_el$7, createComponent(Immobile, {}));
          return _el$7;
        }
      }), null);
      insert(_el$8, () => props.target.name);
      createRenderEffect((_p$) => {
        var _v$ = props.draggable, _v$2 = props.style, _v$3 = `group relative w-(--small-chip-width) transition transition-discrete duration-175 ${interactive ? "cursor-pointer hover:scale-107" : ""} ${props.dimmed ? "cursor-not-allowed" : ""}`, _v$4 = `relative box-border flex max-h-(--small-chip-height) w-(--small-chip-width) flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "outline-3 group-hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"}`, _v$5 = `relative flex justify-center overflow-hidden bg-[#C9C8CD] ${props.dimmed ? "opacity-40" : ""}`, _v$6 = `font-condensed max-h-fit overflow-hidden border-t-3 bg-[#1C2A32] p-1 text-center text-xs font-bold overflow-ellipsis whitespace-nowrap text-[#EFEFEF] ${rarityBorderColor(doll.rarity)} ${props.dimmed ? "opacity-40" : ""}`;
        _v$ !== _p$.e && setAttribute(_el$, "draggable", _p$.e = _v$);
        _p$.t = style(_el$, _v$2, _p$.t);
        _v$3 !== _p$.a && className(_el$, _p$.a = _v$3);
        _v$4 !== _p$.o && className(_el$3, _p$.o = _v$4);
        _v$5 !== _p$.i && className(_el$4, _p$.i = _v$5);
        _v$6 !== _p$.n && className(_el$8, _p$.n = _v$6);
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
    })()
  );
}
delegateEvents(["click", "pointerdown"]);

// src/components/modals/FullScreen.tsx
var _tmpl$25 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90">`);
function FullScreen(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$25();
    insert(_el$, resolved);
    return _el$;
  })();
}

// src/components/modals/ModalHeader.tsx
var _tmpl$26 = /* @__PURE__ */ template(`<div class="mb-1.75 flex flex-col"><h2 class="h-15 flex-1 content-center bg-[#C2C0C4] text-center text-3xl font-extrabold text-[#384B53]"></h2><div class="mt-1.75 border-t-3 border-[#B5B5B6]">`);
function ModalHeader(props) {
  return (() => {
    var _el$ = _tmpl$26(), _el$2 = _el$.firstChild;
    insert(_el$2, () => props.title);
    return _el$;
  })();
}

// src/components/modals/ModalFooter.tsx
var _tmpl$27 = /* @__PURE__ */ template(`<div class="flex flex-col"><div class="my-1.75 border-t-3 border-[#B5B5B6]"></div><div>`);
function ModalFooter(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$27(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
    insert(_el$3, resolved);
    createRenderEffect(() => className(_el$3, `flex px-4 py-4 pt-2.25 ${props.styles}`));
    return _el$;
  })();
}

// src/components/modals/ConfirmModal.tsx
var _tmpl$28 = /* @__PURE__ */ template(`<div class="text-md justify-center text-center font-bold text-[#1C2A32]">`);
function ConfirmModal(props) {
  function getTextWidth(text) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return "w-auto";
    context.font = "bold 16px Roboto, sans-serif";
    const metrics = context.measureText(text);
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
                    var _el$ = _tmpl$28();
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

// src/components/modals/CustomMapModal.tsx
var _tmpl$29 = /* @__PURE__ */ template(`<textarea class="h-36 shrink-0 resize-none rounded-md bg-zinc-950 p-3 font-mono text-xs font-normal text-[#EFEFEF]"placeholder="Paste map JSON exported from the Map Editor...">`);
var _tmpl$210 = /* @__PURE__ */ template(`<div class=text-[#384B53]>Keep "<!>" in a slot so you can edit it and use it in other timelines.`);
var _tmpl$34 = /* @__PURE__ */ template(`<div class=text-[#AE4749]>`);
var _tmpl$43 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2 px-3 text-sm font-bold text-[#1C2A32]"><div class="text-md flex h-9 items-center bg-[#384B53] px-3 tracking-wide text-[#ECECEC]">Choose a slot`);
var _tmpl$52 = /* @__PURE__ */ template(`<button type=button><span>Slot </span><span>`);
function CustomMapModal(props) {
  const mount = document.querySelector("#body") ?? document.body;
  const [text, setText] = createSignal("");
  const [error, setError] = createSignal("");
  const [chosen, setChosen] = createSignal(slots().findIndex((map) => map === null));
  const [confirmOverwrite, setConfirmOverwrite] = createSignal(false);
  const slot = () => chosen() ?? -1;
  const incoming = () => {
    let map;
    if (props.mode === "import") {
      try {
        map = parseMapJson(text());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      }
    } else if (state.customMap) {
      map = toPlainMap(state.customMap);
    } else {
      setError("This timeline doesn't use a custom map");
      return null;
    }
    map.name = uniqueMapName(map.name, slots(), slot());
    return map;
  };
  const store = () => {
    const map = incoming();
    if (!map || slot() < 0) return;
    selectMap(map);
    saveSlot(slot(), map);
    saveToLocalStorage();
    props.onClose();
  };
  const confirm = () => {
    setError("");
    if (slot() < 0) {
      setError("Choose a slot");
      return;
    }
    if (!incoming()) return;
    if (slots()[slot()]) setConfirmOverwrite(true);
    else store();
  };
  return createComponent(Portal, {
    mount,
    get children() {
      return [createComponent(FullScreen, {
        get children() {
          return createComponent(Modal, {
            width: "w-150",
            get children() {
              return [createComponent(ModalHeader, {
                get title() {
                  return props.mode === "import" ? "Import Custom Map" : "Save Map to Slot";
                }
              }), (() => {
                var _el$ = _tmpl$43(), _el$7 = _el$.firstChild;
                insert(_el$, createComponent(Show, {
                  get when() {
                    return props.mode === "import";
                  },
                  get children() {
                    var _el$2 = _tmpl$29();
                    _el$2.$$input = (e) => setText(e.currentTarget.value);
                    setAttribute(_el$2, "spellcheck", false);
                    createRenderEffect(() => _el$2.value = text());
                    return _el$2;
                  }
                }), _el$7);
                insert(_el$, createComponent(Show, {
                  get when() {
                    return props.mode === "save";
                  },
                  get children() {
                    var _el$3 = _tmpl$210(), _el$4 = _el$3.firstChild, _el$6 = _el$4.nextSibling, _el$5 = _el$6.nextSibling;
                    insert(_el$3, () => state.customMap?.name, _el$6);
                    return _el$3;
                  }
                }), _el$7);
                insert(_el$, createComponent(For, {
                  get each() {
                    return Array.from({
                      length: MAP_SLOT_COUNT
                    }, (_, i) => i);
                  },
                  children: (index) => (() => {
                    var _el$9 = _tmpl$52(), _el$0 = _el$9.firstChild, _el$1 = _el$0.firstChild, _el$10 = _el$0.nextSibling;
                    _el$9.$$click = () => setChosen(index);
                    insert(_el$0, index + 1, null);
                    insert(_el$10, () => slots()[index]?.name ?? "Empty");
                    createRenderEffect((_p$) => {
                      var _v$ = `gf-card flex cursor-pointer items-center gap-3 text-left outline-3 ${chosen() === index ? "outline-[#F0AF16]" : "outline-transparent hover:outline-white"}`, _v$2 = `truncate ${slots()[index] ? "" : "font-normal text-[#9AA3A8] italic"}`;
                      _v$ !== _p$.e && className(_el$9, _p$.e = _v$);
                      _v$2 !== _p$.t && className(_el$10, _p$.t = _v$2);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$9;
                  })()
                }), null);
                insert(_el$, createComponent(Show, {
                  get when() {
                    return error();
                  },
                  get children() {
                    var _el$8 = _tmpl$34();
                    insert(_el$8, error);
                    return _el$8;
                  }
                }), null);
                return _el$;
              })(), createComponent(ModalFooter, {
                styles: "justify-between",
                get children() {
                  return [createComponent(Button, {
                    onClick: () => {
                      props.onClose();
                    },
                    color: "dark",
                    design: "cancel"
                  }), createComponent(Button, {
                    onClick: confirm,
                    color: "dark",
                    design: "confirm"
                  })];
                }
              })];
            }
          });
        }
      }), createComponent(ConfirmModal, {
        mount,
        title: "Replace map",
        get content() {
          return `Replace "${slots()[slot()]?.name ?? ""}" in slot ${slot() + 1}?`;
        },
        isActive: confirmOverwrite,
        setActive: setConfirmOverwrite,
        onClick: store
      })];
    }
  });
}
delegateEvents(["input", "click"]);

// src/components/Dropdown.tsx
var _tmpl$30 = /* @__PURE__ */ template(`<ul class=dropdown-list role=listbox>`);
var _tmpl$211 = /* @__PURE__ */ template(`<div><button type=button class=dropdown-control aria-haspopup=listbox><span class=dropdown-value></span><span class=dropdown-arrow>\u25BE`);
var _tmpl$35 = /* @__PURE__ */ template(`<li role=option class=dropdown-option>`);
var [openDropdown, setOpenDropdown] = createSignal(null);
function Dropdown(props) {
  const id = /* @__PURE__ */ Symbol("dropdown");
  let root2;
  const [selected, setSelected] = createSignal(props.value);
  createEffect(() => {
    setSelected(() => props.value);
  });
  const [cursor, setCursor] = createSignal(-1);
  const isOpen = () => openDropdown() === id;
  const open = () => {
    setCursor(Math.max(0, props.options.indexOf(selected())));
    setOpenDropdown(id);
  };
  const close = () => {
    if (isOpen()) setOpenDropdown(null);
  };
  const pick = (option) => {
    close();
    if (option === selected()) return;
    setSelected(() => option);
    props.onChange(option);
  };
  const moveCursor = (delta) => {
    const count = props.options.length;
    setCursor((index) => (index + delta + count) % count);
  };
  const onKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        if (isOpen()) moveCursor(e.key === "ArrowDown" ? 1 : -1);
        else open();
        break;
      case "Enter":
      case " ":
        if (!isOpen()) open();
        else if (cursor() > -1) pick(props.options[cursor()]);
        break;
      case "Escape":
        if (!isOpen()) return;
        close();
        break;
      default:
        return;
    }
    e.preventDefault();
  };
  const onDocumentPointerDown = (e) => {
    if (isOpen() && !root2?.contains(e.target)) close();
  };
  document.addEventListener("pointerdown", onDocumentPointerDown);
  onCleanup(() => {
    document.removeEventListener("pointerdown", onDocumentPointerDown);
    close();
  });
  return (() => {
    var _el$ = _tmpl$211(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
    _el$.$$focusout = (e) => {
      if (!root2?.contains(e.relatedTarget)) close();
    };
    use((el) => {
      root2 = el;
    }, _el$);
    _el$2.$$keydown = onKeyDown;
    _el$2.$$click = () => {
      if (isOpen()) close();
      else open();
    };
    insert(_el$3, selected);
    insert(_el$, createComponent(Show, {
      get when() {
        return isOpen();
      },
      get children() {
        var _el$4 = _tmpl$30();
        _el$4.$$mousedown = (e) => {
          e.preventDefault();
        };
        insert(_el$4, createComponent(For, {
          get each() {
            return props.options;
          },
          children: (option, index) => (() => {
            var _el$5 = _tmpl$35();
            _el$5.$$click = () => {
              pick(option);
            };
            _el$5.addEventListener("pointerenter", () => {
              setCursor(index());
            });
            use((el) => {
              createEffect(() => {
                if (index() === cursor()) el.scrollIntoView({
                  block: "nearest"
                });
              });
            }, _el$5);
            insert(_el$5, option);
            createRenderEffect((_p$) => {
              var _v$4 = option === selected(), _v$5 = option === selected(), _v$6 = index() === cursor();
              _v$4 !== _p$.e && setAttribute(_el$5, "aria-selected", _p$.e = _v$4);
              _v$5 !== _p$.t && setAttribute(_el$5, "data-selected", _p$.t = _v$5);
              _v$6 !== _p$.a && setAttribute(_el$5, "data-cursor", _p$.a = _v$6);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0
            });
            return _el$5;
          })()
        }));
        return _el$4;
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = `dropdown ${props.class ?? ""}`, _v$2 = isOpen(), _v$3 = isOpen();
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "data-open", _p$.t = _v$2);
      _v$3 !== _p$.a && setAttribute(_el$2, "aria-expanded", _p$.a = _v$3);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$;
  })();
}
delegateEvents(["focusout", "click", "keydown", "mousedown"]);

// src/components/SetupSidebar.tsx
var _tmpl$31 = /* @__PURE__ */ template(`<div>`);
var _tmpl$212 = /* @__PURE__ */ template(`<div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Summons (drag to map)`);
var _tmpl$36 = /* @__PURE__ */ template(`<div class="flex flex-wrap gap-3">`);
var _tmpl$44 = /* @__PURE__ */ template(`<div class=text-[#9AA3A8]>`);
var _tmpl$53 = /* @__PURE__ */ template(`<div class="mx-3 flex flex-col gap-2 self-stretch bg-[#2A3D46] p-2 text-xs font-normal text-[#C9C8CE]"><div class="flex items-center gap-1.5 font-bold text-[#EFEFEF]"><span class="gf-badge gf-badge-missing h-4 w-4 shrink-0"></span>Missing required keys`);
var _tmpl$62 = /* @__PURE__ */ template(`<div><div class="flex flex-col items-center gap-3 pt-1 text-sm font-bold text-[#384B53]"><div class="flex flex-row gap-2"></div><div class="flex flex-row gap-2"></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Echelon (drag to map)</div><div class="flex flex-wrap gap-3"></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">State Management</div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#AE4749] font-bold tracking-wide text-[#ECECEC]">Danger Zone`);
var needsText2 = (owner, missingKey) => `Needs ${getSelectedDoll(owner).name} to equip ${keyName(missingKey)}`;
var canPlaceLocked = () => localState.alwaysDisplaySkills;
var lockedConsequence = (subject = "it") => canPlaceLocked() ? "" : `To place ${subject} anyway, set "Show all skills and summons" to "always" in Options.`;
function SummonChip(props) {
  const needs = props.missingKey && needsText2(props.owner, props.missingKey);
  const deployable = () => !props.missingKey || canPlaceLocked();
  return (() => {
    var _el$ = _tmpl$31();
    insert(_el$, createComponent(Show, {
      get when() {
        return deployable();
      },
      get fallback() {
        return createComponent(SmallDollChip, {
          get target() {
            return props.summon;
          },
          alert: true,
          dimmed: true
        });
      },
      get children() {
        return createComponent(SmallDollChip, {
          get target() {
            return props.summon;
          },
          get alert() {
            return !!props.missingKey;
          },
          onDragStart: (e) => {
            e.preventDefault();
          },
          onPointerDown: (e) => {
            e.preventDefault();
            deployFromSetupPanel(props.summon.id, nextSummonInstanceId(state.tabData), e);
          }
        });
      }
    }));
    createRenderEffect(() => setAttribute(_el$, "title", needs ? `${needs}. ${lockedConsequence()}` : void 0));
    return _el$;
  })();
}
function SetupSidebar(props) {
  const isActionTab = createMemo(() => localState.currentTab >= 1 && localState.currentTab <= 7);
  const availableSummons = createMemo(() => isActionTab() ? getSummonsFromSelectedDolls(state.selectedDolls) : []);
  const lockedByKey = createMemo(() => {
    const groups = /* @__PURE__ */ new Map();
    for (const setupSummon of availableSummons()) {
      const {
        owner,
        missingKey
      } = setupSummon;
      if (!missingKey) continue;
      const id = `${owner.id}:${missingKey}`;
      const group = groups.get(id) ?? {
        owner,
        keyId: missingKey,
        summons: []
      };
      group.summons.push(setupSummon);
      groups.set(id, group);
    }
    return [...groups.values()];
  });
  const lockedCount = () => lockedByKey().reduce((count, group) => count + group.summons.length, 0);
  const [showClearSkillModal, setShowClearSkillModal] = createSignal(false);
  const [showClearTurnModal, setShowClearTurnModal] = createSignal(false);
  const [showClearDataModal, setShowClearDataModal] = createSignal(false);
  const [customMapModal, setCustomMapModal] = createSignal(null);
  const choices = createMemo(() => mapChoices());
  const unsavedMap = () => !isBuiltInMap(state.map) && state.customMap !== void 0 && timelineSlot() === -1;
  const openDollSelector = () => {
    setupTempSelectedDolls();
    const nums = {};
    state.selectedDolls.forEach((d) => {
      nums[d.id] = d.fortification;
    });
    setDollFortification(nums);
    setActivePhaseTab(8 /* All */);
    setShowDollModal(true);
  };
  const clearCurrentTurn = () => {
    if (localState.currentTab === -1) return;
    setState(produce((s) => {
      const tab = s.tabData[localState.currentTab];
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
        const dollInfo = getSelectedDoll(doll);
        for (const summon of dollInfo.summons) tab.actions[summon.id] = [];
      }
    }));
    defaultActionOrder(localState.currentTab);
    saveToLocalStorage();
  };
  const clearSavedData = () => {
    resetToDefaultState();
    location.reload();
  };
  const clearSkills = () => {
    if (localState.currentTab < 0 || localState.currentTab > 7) return;
    setState(produce((s) => {
      const tab = s.tabData[localState.currentTab];
      for (const dollId of Object.keys(tab.actions)) {
        tab.actions[dollId] = [];
      }
    }));
    saveToLocalStorage();
  };
  return (() => {
    var _el$2 = _tmpl$62(), _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling, _el$7 = _el$6.nextSibling, _el$12 = _el$7.nextSibling, _el$13 = _el$12.nextSibling;
    insert(_el$3, createComponent(Dropdown, {
      get options() {
        return choices().map((choice) => choice.label);
      },
      get value() {
        return currentMapLabel();
      },
      onChange: (value) => {
        const choice = choices().find((c) => c.label === value);
        if (!choice) return;
        selectMap(choice.map);
        saveToLocalStorage();
      }
    }), _el$4);
    insert(_el$4, createComponent(Button, {
      color: "dark",
      onClick: () => setCustomMapModal("import"),
      design: "custom",
      content: "Import Custom Map"
    }), null);
    insert(_el$4, createComponent(Show, {
      get when() {
        return unsavedMap();
      },
      get children() {
        return createComponent(Button, {
          color: "dark",
          onClick: () => setCustomMapModal("save"),
          design: "custom",
          content: "Save to Slot"
        });
      }
    }), null);
    insert(_el$3, createComponent(Show, {
      get when() {
        return customMapModal();
      },
      children: (mode) => createComponent(CustomMapModal, {
        get mode() {
          return mode();
        },
        onClose: () => setCustomMapModal(null)
      })
    }), _el$5);
    insert(_el$5, createComponent(Button, {
      color: "dark",
      onClick: openDollSelector,
      design: "custom",
      content: "Select Dolls"
    }), null);
    insert(_el$5, createComponent(Button, {
      color: "dark",
      onClick: openFormation,
      design: "custom",
      content: "Change Equip"
    }), null);
    insert(_el$3, createComponent(Button, {
      color: "dark",
      onClick: () => setShowBuffModal(true),
      design: "custom",
      content: "Select Support Buff"
    }), _el$6);
    insert(_el$7, createComponent(For, {
      get each() {
        return state.selectedDolls;
      },
      children: (doll) => {
        const dollInfo = getSelectedDoll(doll);
        if (!dollInfo) return null;
        return createComponent(SmallDollChip, {
          target: dollInfo,
          onDragStart: (e) => {
            e.preventDefault();
          },
          onPointerDown: (e) => {
            e.preventDefault();
            deployFromSetupPanel(doll.id, null, e);
          }
        });
      }
    }));
    insert(_el$3, createComponent(Show, {
      get when() {
        return memo(() => !!isActionTab())() && availableSummons().length > 0;
      },
      get children() {
        return [_tmpl$212(), (() => {
          var _el$9 = _tmpl$36();
          insert(_el$9, createComponent(For, {
            get each() {
              return availableSummons();
            },
            children: (availableSummon) => createComponent(SummonChip, availableSummon)
          }));
          return _el$9;
        })(), createComponent(Show, {
          get when() {
            return lockedByKey().length > 0;
          },
          get children() {
            var _el$0 = _tmpl$53(), _el$1 = _el$0.firstChild, _el$10 = _el$1.firstChild;
            insert(_el$10, createComponent(Alert, {}));
            insert(_el$0, createComponent(Show, {
              get when() {
                return lockedConsequence();
              },
              get children() {
                var _el$11 = _tmpl$44();
                insert(_el$11, () => lockedConsequence(lockedCount() > 1 ? "them" : "it"));
                return _el$11;
              }
            }), null);
            return _el$0;
          }
        })];
      }
    }), _el$12);
    insert(_el$3, createComponent(Button, {
      onClick: () => setShowSkillDisplayModal(true),
      color: "dark",
      design: "custom",
      content: "Options"
    }), _el$13);
    insert(_el$3, createComponent(Button, {
      onClick: () => setShowExportModal(true),
      color: "dark",
      design: "custom",
      content: "Export / Share"
    }), _el$13);
    insert(_el$3, createComponent(Button, {
      onClick: () => setShowImportModal(true),
      color: "dark",
      design: "custom",
      content: "Import Transcript"
    }), _el$13);
    insert(_el$3, createComponent(Button, {
      onClick: () => setShowClearSkillModal(true),
      color: "red",
      design: "custom",
      content: "Clear Skills This Turn"
    }), null);
    insert(_el$3, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body") ?? document.body;
      },
      title: "Caution",
      content: "Clear all skill usage for current turn?",
      isActive: showClearSkillModal,
      setActive: setShowClearSkillModal,
      onClick: clearSkills
    }), null);
    insert(_el$3, createComponent(Button, {
      onClick: () => setShowClearTurnModal(true),
      color: "red",
      design: "custom",
      content: "Clear This Entire Turn"
    }), null);
    insert(_el$3, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body") ?? document.body;
      },
      title: "Caution",
      content: "Clear all skill usage and doll positions for current turn?",
      isActive: showClearTurnModal,
      setActive: setShowClearTurnModal,
      onClick: clearCurrentTurn
    }), null);
    insert(_el$3, createComponent(Button, {
      onClick: () => setShowClearDataModal(true),
      color: "red",
      design: "custom",
      content: "Clear All Turns"
    }), null);
    insert(_el$3, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body") ?? document.body;
      },
      title: "Caution",
      content: "Clear all stored data for all turns?",
      isActive: showClearDataModal,
      setActive: setShowClearDataModal,
      onClick: clearSavedData
    }), null);
    createRenderEffect(() => className(_el$2, `${props.active ? "" : "hidden"} overflow-y-auto`));
    return _el$2;
  })();
}

// src/components/icons/SkillIcon.tsx
var _tmpl$37 = /* @__PURE__ */ template(`<div class="skill-icon shrink-0 cursor-pointer"><img decoding=async width=40 height=40>`);
function SkillIcon(props) {
  return (() => {
    var _el$ = _tmpl$37(), _el$2 = _el$.firstChild;
    addEventListener(_el$, "click", props.onClick, true);
    createRenderEffect((_p$) => {
      var _v$ = props.skill.icon, _v$2 = `h-10 w-10 rounded-sm border-2 border-[#717376] bg-black/70 object-cover outline-2 outline-transparent transition transition-discrete duration-175 ${props.onClick ? "hover:scale-107 hover:outline-white" : ""}`, _v$3 = `${props.skill.name} lv. ${props.skill.level ?? 1} [${props.skill.id}]`;
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
var _tmpl$38 = /* @__PURE__ */ template(`<div class="absolute top-0.5 left-0.5 h-4 w-4">`);
var _tmpl$213 = /* @__PURE__ */ template(`<span class="gf-badge gf-badge-inert pointer-events-auto absolute right-0.5 bottom-0.5 z-20"title="No skills: it can't move or act, it only occupies a tile">`);
var _tmpl$39 = /* @__PURE__ */ template(`<div class="font-condensed absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/70 via-transparent to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class="overflow-hidden overflow-ellipsis whitespace-nowrap">`);
var _tmpl$45 = /* @__PURE__ */ template(`<div><div class="relative flex justify-center overflow-hidden bg-[#909597]"><img loading=lazy decoding=async width=56 height=56>`, true, false, false);
var _tmpl$54 = /* @__PURE__ */ template(`<div class="absolute top-0.5 right-0.5 h-5 w-5 shadow-sm shadow-black/20">`);
function SquareDollChip(props) {
  const doll = getDollByDollOrSummon(props.target);
  const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
  const interactive = typeof props.onClick !== "undefined";
  return (() => {
    var _el$ = _tmpl$45(), _el$2 = _el$.firstChild, _el$4 = _el$2.firstChild;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$8 = _tmpl$54();
        insert(_el$8, createComponent(Check, {}));
        return _el$8;
      })();
    })(), _el$4);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.icon;
      },
      get children() {
        var _el$3 = _tmpl$38();
        insert(_el$3, createComponent(PhaseIcon, {
          get phase() {
            return doll.phase;
          }
        }));
        return _el$3;
      }
    }), _el$4);
    setAttribute(_el$4, "src", icon);
    insert(_el$2, createComponent(Show, {
      get when() {
        return isUnreleased(props.target);
      },
      get children() {
        return createComponent(UnreleasedBadge, {
          "class": "bottom-0.5 left-0.5 z-20 text-[10px]"
        });
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return isInertSummon(props.target);
      },
      get children() {
        var _el$5 = _tmpl$213();
        insert(_el$5, createComponent(Immobile, {}));
        return _el$5;
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return props.name;
      },
      get children() {
        var _el$6 = _tmpl$39(), _el$7 = _el$6.firstChild;
        insert(_el$7, () => props.target.name);
        return _el$6;
      }
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = props.draggable, _v$2 = props.style, _v$3 = `relative box-border flex ${props.size ?? "h-14 w-14"} flex-col overflow-hidden border-b-3 shadow-sm shadow-black/50 transition transition-discrete duration-175 ${interactive ? "cursor-pointer outline-3 hover:scale-107 hover:outline-white" : ""} ${props.selected ? "outline-[#F26C1C]" : "outline-transparent"} ${rarityBorderColor(doll.rarity)} ${props.rounded ? "rounded-sm" : ""}`, _v$4 = `${props.size ?? "h-14 w-14"} object-cover object-top`;
      _v$ !== _p$.e && setAttribute(_el$, "draggable", _p$.e = _v$);
      _p$.t = style(_el$, _v$2, _p$.t);
      _v$3 !== _p$.a && className(_el$, _p$.a = _v$3);
      _v$4 !== _p$.o && className(_el$4, _p$.o = _v$4);
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

// src/components/ActionSidebar.tsx
var _tmpl$40 = /* @__PURE__ */ template(`<button class="cursor-pointer rounded-sm bg-[#384B53] p-0.5 hover:outline-3 hover:outline-white">`);
var _tmpl$214 = /* @__PURE__ */ template(`<div><div class="flex flex-col gap-1.5 border-2 border-[#D7D7D7] p-1"><div class="drag-grip flex items-center gap-2"><div class="flex flex-col gap-0.5"></div><div class="min-w-0 flex-1"><div class="mt-1 flex flex-wrap gap-1"></div></div></div><div class="flex flex-wrap gap-1.5">`);
var _tmpl$310 = /* @__PURE__ */ template(`<span class="mr-1 inline-block h-3 w-3 align-[-1px] text-[#F0AF16]">`);
var _tmpl$46 = /* @__PURE__ */ template(`<div class="group relative"><div>`);
var _tmpl$55 = /* @__PURE__ */ template(`<div>`);
function handleSkillClick(id, skill) {
  if (!isPlaced(id)) {
    alert("Place doll first!");
    return;
  }
  if (needsAllyTarget(skill)) {
    setTargetDollId(id);
    setTargetSkillId(skill.id);
    setShowTargetModal(true);
  } else {
    recordSkill(id, [skill.id]);
  }
}
function recordSkill(dollId, entry) {
  if (localState.currentTab < 0 || localState.currentTab > 7) return;
  setState(produce((s) => {
    const tab = s.tabData[localState.currentTab];
    if (!tab.actions[dollId]) tab.actions[dollId] = [];
    tab.actions[dollId].push(entry);
  }));
  saveToLocalStorage();
}
function removeAction(dollId, actionIdx) {
  setState(produce((s) => {
    s.tabData[localState.currentTab].actions[dollId]?.splice(actionIdx, 1);
  }));
  saveToLocalStorage();
}
function swapInOrder(orderId, neighbourId) {
  setState(produce((s) => {
    const order = s.tabData[localState.currentTab].actionOrder;
    const index = order.indexOf(orderId);
    const neighbourIndex = order.indexOf(neighbourId);
    if (index === -1 || neighbourIndex === -1) return;
    order[index] = neighbourId;
    order[neighbourIndex] = orderId;
  }));
  saveToLocalStorage();
}
function MoveButton(props) {
  return (() => {
    var _el$ = _tmpl$40();
    _el$.$$click = () => {
      swapInOrder(props.orderId, props.neighbourId);
    };
    insert(_el$, () => props.label);
    return _el$;
  })();
}
function DollRow(props) {
  const placed = createMemo(() => isPlaced(props.doll.id));
  const actions = createMemo(() => state.tabData[localState.currentTab]?.actions[props.doll.id] ?? []);
  const skills = [...getSortedUsableSkills(props.doll), endTurnSkill];
  return (() => {
    var _el$2 = _tmpl$214(), _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.nextSibling, _el$7 = _el$6.firstChild, _el$8 = _el$4.nextSibling;
    insert(_el$5, createComponent(Show, {
      get when() {
        return props.aboveId;
      },
      children: (aboveId) => createComponent(MoveButton, {
        label: "Up",
        get orderId() {
          return props.orderId;
        },
        get neighbourId() {
          return aboveId();
        }
      })
    }), null);
    insert(_el$5, createComponent(Show, {
      get when() {
        return props.belowId;
      },
      children: (belowId) => createComponent(MoveButton, {
        label: "Down",
        get orderId() {
          return props.orderId;
        },
        get neighbourId() {
          return belowId();
        }
      })
    }), null);
    insert(_el$4, createComponent(SquareDollChip, {
      get target() {
        return props.doll;
      },
      icon: true,
      name: true
    }), _el$6);
    insert(_el$7, createComponent(For, {
      get each() {
        return actions();
      },
      children: (action, ai) => {
        const at = () => ({
          tab: localState.currentTab,
          ownerId: props.doll.id,
          index: ai()
        });
        const errors = createMemo(() => getActionErrors(at()));
        return (() => {
          var _el$9 = _tmpl$46(), _el$0 = _el$9.firstChild;
          _el$0.$$click = () => {
            removeAction(props.doll.id, ai());
          };
          insert(_el$0, createComponent(Show, {
            get when() {
              return errors().length;
            },
            get children() {
              var _el$1 = _tmpl$310();
              insert(_el$1, createComponent(Alert, {}));
              return _el$1;
            }
          }), null);
          insert(_el$0, () => renderAction(action, at()), null);
          createRenderEffect((_p$) => {
            var _v$3 = `drag-ignore cursor-pointer rounded-sm ${errors().length ? "bg-[#ae4749]" : "bg-[#384B53]"} px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50 hover:bg-red-900 hover:text-red-300`, _v$4 = [...errors().map((e) => e.message), "Click to remove"].join("\n"), _v$5 = ai();
            _v$3 !== _p$.e && className(_el$0, _p$.e = _v$3);
            _v$4 !== _p$.t && setAttribute(_el$0, "title", _p$.t = _v$4);
            _v$5 !== _p$.a && setAttribute(_el$0, "data-action-idx", _p$.a = _v$5);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$9;
        })();
      }
    }));
    insert(_el$8, createComponent(For, {
      each: skills,
      children: (skill) => createComponent(SkillIcon, {
        skill,
        onClick: () => {
          handleSkillClick(props.doll.id, skill);
        }
      })
    }));
    createRenderEffect((_p$) => {
      var _v$ = `doll-row is-idle rounded-sm bg-[#E6E6E6] p-1 shadow-sm shadow-black/50 ${placed() ? "border-lime-400/40" : "border-zinc-700"}`, _v$2 = props.doll.id;
      _v$ !== _p$.e && className(_el$2, _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$2, "data-doll-id", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$2;
  })();
}
function ActionSidebar(props) {
  const rows = createMemo(() => {
    if (localState.currentTab < 0 || localState.currentTab > 7) return [];
    const tab = localState.currentTab;
    const order = state.tabData[tab]?.actionOrder ?? [];
    return order.flatMap((orderId, index) => {
      if (!isRenderable({
        kind: "actionOrder" /* ActionOrder */,
        tab,
        index
      })) return [];
      return getActionBarEntities([orderId]).map((entity) => ({
        orderId,
        entity
      }));
    });
  });
  return (() => {
    var _el$10 = _tmpl$55();
    insert(_el$10, createComponent(For, {
      get each() {
        return rows();
      },
      children: (row, i) => createComponent(DollRow, {
        get doll() {
          return row.entity;
        },
        get orderId() {
          return row.orderId;
        },
        get aboveId() {
          return rows()[i() - 1]?.orderId;
        },
        get belowId() {
          return rows()[i() + 1]?.orderId;
        }
      })
    }));
    createRenderEffect(() => className(_el$10, `flex flex-col gap-1.5 overflow-y-auto p-1 ${props.active ? "" : "hidden"}`));
    return _el$10;
  })();
}
delegateEvents(["click"]);

// src/components/ArenaCanvas.tsx
var _tmpl$41 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75"><button><span>Setup</span></button><button><span>Doll Actions`);
var _tmpl$215 = /* @__PURE__ */ template(`<div><div class="flex flex-1 touch-none"><canvas></canvas><div class="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs text-lime-400"></div><div><div class="h-10 w-10"></div><span class="text-center text-lg leading-tight font-bold text-[#f87171]">Remove</span></div></div><div class="absolute top-3.75 bottom-3.75 left-3.75 z-10 flex">`);
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
      if (!prev) return;
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
    if (!currA || !currB || !prevA || !prevB) return;
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
    maxX: mapGrid.width * TILE_SIZE,
    maxY: mapGrid.height * TILE_SIZE
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
  const scaleX = cssW / (mapGrid.width * TILE_SIZE);
  const scaleY = cssH / (mapGrid.height * TILE_SIZE);
  return Math.max(MIN_SCALE, Math.min(scaleX, scaleY));
}
function draw() {
  if (!ctx) return;
  if (localState.currentTab < 0 || localState.currentTab > 7) return;
  const {
    width,
    height
  } = canvasEl;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  applyCamera();
  drawMapTilesOnArena(ctx, drag, localState.currentTab);
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
  requestAnimationFrame(() => {
    loop();
  });
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
  const isSetup = localState.currentTab === 0;
  const isSpawnTile = isTileType(cell, 1 /* Spawn */);
  const inBounds = tileX >= 0 && tileX < mapGrid.width && tileY >= 0 && tileY < mapGrid.height;
  const isBlocked = isTileType(cell, 8 /* HalfCover */) || isTileType(cell, 16 /* FullCover */) || isTileType(cell, 32 /* BossCover */) || isTileType(cell, 64 /* BossOrigin */);
  if (!inBounds || isSetup && !isSpawnTile || !isSetup && isBlocked) return 1 /* Blocked */;
  const tab = state.tabData[localState.currentTab];
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
    if (hasPrefix(drag2.id, "m" /* Summons */) && drag2.instanceId) {
      placeSummon(drag2.id, drag2.instanceId, drag2.currentTileX, drag2.currentTileY);
    } else if (hasPrefix(drag2.id, "d" /* Dolls */)) {
      placeDoll(drag2.id, drag2.currentTileX, drag2.currentTileY);
    }
  }
}
function updateDragInfo(clientX, clientY) {
  if (!drag.isActive) return;
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
  const tab = state.tabData[localState.currentTab];
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
  window.addEventListener("resize", () => {
    fitToWindow();
  });
  window.matchMedia(`(resolution: ${dpr}dppx)`).addEventListener("change", () => {
    fitToWindow();
  });
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
    const context = canvasEl.getContext("2d");
    if (!context) throw new Error("Could not get 2D canvas context");
    ctx = context;
    bindResize();
    loop();
  });
  const isSetupTab = () => activeTab() === "setup" || localState.currentTab === 0;
  const isActionTab = () => activeTab() === "actions" && localState.currentTab > 0;
  const isDragActive = () => drag.isActive;
  return (() => {
    var _el$ = _tmpl$215(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$2.nextSibling;
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
      width: "w-(--sidebar-width)",
      get children() {
        return [(() => {
          var _el$8 = _tmpl$41(), _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling;
          _el$9.$$click = () => {
            setActiveTab("setup");
          };
          _el$0.$$click = () => {
            setActiveTab("actions");
          };
          createRenderEffect((_p$) => {
            var _v$ = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isSetupTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${isActionTab() ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"} ${localState.currentTab === 0 ? "cursor-not-allowed opacity-50" : ""}`;
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

// src/store/mapGrid.ts
var mapGrid = { id: "default", name: "Default", width: 21, height: 21, priority: [], tiles: [] };
function gridKey(x, y, width) {
  return y * (width ?? mapGrid.width) + x;
}
function cellX(c) {
  return c * TILE_SIZE;
}
function cellY(r) {
  return r * TILE_SIZE;
}
function inMapBounds(c, r) {
  return c >= 0 && c < mapGrid.width && r >= 0 && r < mapGrid.height;
}
function isTileType(tile, type) {
  return (tile & type) === type;
}
function getCell(column, row) {
  if (!inMapBounds(column, row)) {
    console.error("Out of bound tile", column, row, mapGrid.width, mapGrid.height);
    return 0 /* Empty */;
  }
  return mapGrid.tiles[row * mapGrid.width + column];
}
function indexToCoords(index, width) {
  const x = index % width;
  const y = Math.floor(index / width);
  return { x, y };
}
function getBoss() {
  const bossIndex = mapGrid.tiles.findIndex((tile) => isTileType(tile, 64 /* BossOrigin */));
  if (bossIndex > -1) {
    return indexToCoords(bossIndex, mapGrid.width);
  }
  return { x: 0, y: 0 };
}
function hasCover(c, r) {
  if (!inMapBounds(c, r)) return false;
  const cell = mapGrid.tiles[gridKey(c, r)];
  return isTileType(cell, 16 /* FullCover */) || isTileType(cell, 8 /* HalfCover */) || isTileType(cell, 32 /* BossCover */) || isTileType(cell, 64 /* BossOrigin */);
}
function fillGrid(map) {
  mapGrid.name = map.name;
  mapGrid.id = map.id;
  mapGrid.width = map.width;
  mapGrid.height = map.height;
  mapGrid.tiles.length = 0;
  mapGrid.priority.length = 0;
  mapGrid.priority.push(...map.priority);
  mapGrid.tiles.push(...map.tiles);
  camera.x = mapGrid.width * TILE_SIZE / 2;
  camera.y = mapGrid.height * TILE_SIZE / 2;
}
function setCell(x, y, value, merge) {
  const index = gridKey(x, y);
  mapGrid.tiles[index] = merge ? mapGrid.tiles[index] | value : value;
  if (!isTileType(mapGrid.tiles[index], 1 /* Spawn */)) setPriority(index, null);
}
function setPriority(index, rank) {
  const current = mapGrid.priority.indexOf(index);
  if (current > -1) mapGrid.priority.splice(current, 1);
  if (rank === null || !isTileType(mapGrid.tiles[index], 1 /* Spawn */)) return;
  mapGrid.priority.splice(Math.max(0, Math.min(rank - 1, mapGrid.priority.length)), 0, index);
}
function resizeMap(width, height, anchor) {
  const offset = (grow, side) => side === 0 ? 0 : side === 2 ? grow : Math.floor(grow / 2);
  const dx = offset(width - mapGrid.width, anchor.x);
  const dy = offset(height - mapGrid.height, anchor.y);
  const moved = (index) => {
    const { x, y } = indexToCoords(index, mapGrid.width);
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && nx < width && ny >= 0 && ny < height ? gridKey(nx, ny, width) : -1;
  };
  const tiles = Array(width * height).fill(0 /* Empty */);
  for (const [index, tile] of mapGrid.tiles.entries()) {
    const to = moved(index);
    if (to > -1) tiles[to] = tile;
  }
  const priority = mapGrid.priority.map(moved).filter((index) => index > -1);
  const boss = mapGrid.tiles.findIndex((tile) => isTileType(tile, 64 /* BossOrigin */));
  if (boss > -1) {
    const { x, y } = indexToCoords(boss, mapGrid.width);
    const fits = x + dx - 1 >= 0 && x + dx + 1 < width && y + dy - 1 >= 0 && y + dy + 1 < height;
    if (!fits) for (const [index, tile] of tiles.entries()) tiles[index] = tile & ~(32 /* BossCover */ | 64 /* BossOrigin */);
  }
  fillGrid({ id: mapGrid.id, name: mapGrid.name, width, height, tiles, priority });
}
function unsetBoss() {
  for (const [index, tile] of mapGrid.tiles.entries()) {
    if (isTileType(tile, 32 /* BossCover */) || isTileType(tile, 64 /* BossOrigin */)) {
      mapGrid.tiles[index] = mapGrid.tiles[index] & ~32 /* BossCover */;
      mapGrid.tiles[index] = mapGrid.tiles[index] & ~64 /* BossOrigin */;
    }
  }
}

// src/store/placement.ts
function getDollStartingPosition(dollId) {
  const dollPos = state.tabData[0].dollPositions[dollId];
  return gridKey(dollPos?.x ?? -1, dollPos?.y ?? -1);
}
function isPlaced(dollId, tab = localState.currentTab) {
  if (hasPrefix(dollId, "m" /* Summons */)) {
    for (const p of state.tabData[tab].summonPositions) {
      if (p.id === dollId) return true;
    }
  } else if (hasPrefix(dollId, "d" /* Dolls */)) {
    const pos = state.tabData[tab].dollPositions[dollId];
    return !!pos && pos.x > -1;
  } else {
    throw new Error(`Unknown doll/summon id: ${String(dollId)}`);
  }
  return false;
}
function getDollPosition(dollId, instanceId) {
  if (hasPrefix(dollId, "m" /* Summons */)) {
    for (const p of state.tabData[localState.currentTab].summonPositions) {
      if (p.id === dollId && p.mapId === instanceId) return { x: p.x, y: p.y };
    }
  } else if (hasPrefix(dollId, "d" /* Dolls */)) {
    const pos = state.tabData[localState.currentTab].dollPositions[dollId];
    if (pos) return pos;
  } else {
    throw new Error(`Unknown doll/summon id: ${String(dollId)}`);
  }
  return null;
}
function placeDoll(id, x, y) {
  setState(
    produce((s) => {
      s.tabData[localState.currentTab].dollPositions[id] = { x, y };
    })
  );
  saveToLocalStorage();
}
function placeSummon(summonId, mapId, x, y) {
  if (!mapId) throw new Error(`No instanceId for summon: ${summonId}`);
  setState(
    produce((s) => {
      const positions = s.tabData[localState.currentTab].summonPositions;
      const existing = positions.find((p) => p.mapId === mapId && p.id === summonId);
      if (existing) {
        existing.x = x;
        existing.y = y;
      } else {
        for (const p of positions) {
          if (p.x === x && p.y === y) return;
        }
        positions.push({ id: summonId, mapId, x, y });
      }
    })
  );
  saveToLocalStorage();
}
function swapPositions(id, instanceId, x, y, swapDoll) {
  if (!swapDoll) return;
  setState(
    produce((s) => {
      const oldPosition = getDollPosition(id, instanceId);
      if (hasPrefix(id, "d" /* Dolls */)) {
        s.tabData[localState.currentTab].dollPositions[id] = { x, y };
      } else if (hasPrefix(id, "m" /* Summons */)) {
        if (!instanceId) throw new Error(`No instanceId for summon: ${id}`);
        const positions = s.tabData[localState.currentTab].summonPositions;
        const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
        if (existing) {
          existing.x = x;
          existing.y = y;
        } else {
          positions.push({ id, mapId: instanceId, x, y });
        }
      } else {
        throw new Error(`Unknown doll/summon id: ${String(id)}`);
      }
      if (oldPosition) {
        if (hasPrefix(swapDoll.id, "d" /* Dolls */)) {
          s.tabData[localState.currentTab].dollPositions[swapDoll.id] = { x: oldPosition.x, y: oldPosition.y };
        } else if (hasPrefix(swapDoll.id, "m" /* Summons */)) {
          const positions = s.tabData[localState.currentTab].summonPositions;
          const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
          if (existing) {
            existing.x = oldPosition.x;
            existing.y = oldPosition.y;
          }
        } else {
          throw new Error(`Unknown doll/summon id: ${String(swapDoll.id)}`);
        }
      } else {
        if (hasPrefix(swapDoll.id, "d" /* Dolls */)) {
          s.tabData[localState.currentTab].dollPositions[swapDoll.id] = { x: -1, y: -1 };
        } else if (hasPrefix(swapDoll.id, "m" /* Summons */)) {
          const positions = s.tabData[localState.currentTab].summonPositions;
          const existing = positions.find((p) => p.mapId === swapDoll.instanceId && p.id === swapDoll.id);
          if (existing) {
            positions.splice(positions.indexOf(existing), 1);
          }
        } else {
          throw new Error(`Unknown doll/summon id: ${String(swapDoll.id)}`);
        }
      }
    })
  );
  saveToLocalStorage();
}
function removeDollOrSummon(id, instanceId) {
  if (!id) return;
  if (hasPrefix(id, "d" /* Dolls */)) {
    setState(
      produce((s) => {
        s.tabData[localState.currentTab].dollPositions[id] = { x: -1, y: -1 };
      })
    );
    saveToLocalStorage();
  } else if (hasPrefix(id, "m" /* Summons */)) {
    setState(
      produce((s) => {
        const positions = s.tabData[localState.currentTab].summonPositions;
        const existing = positions.find((p) => p.mapId === instanceId && p.id === id);
        if (existing) {
          positions.splice(positions.indexOf(existing), 1);
        }
      })
    );
    saveToLocalStorage();
  } else {
    throw new Error(`Unknown doll/summon id: ${String(id)}`);
  }
}

// src/store/gameData.ts
var combinedDolls = { data: {} };
var combinedBuffs = { data: {} };
var combinedAttachments = { data: {} };
var combinedEnemies = { data: {} };
var combinedKeys = { data: {} };
var combinedRemoldingStats = { data: {} };
var combinedSeasons = { data: {} };
var combinedWeapons = { data: {} };
var summonIdToDollId = /* @__PURE__ */ new Map();
var skillIdToEntityId = /* @__PURE__ */ new Map();
var fixedKeyIdToDollId = /* @__PURE__ */ new Map();
var dollIdToWeaponId = /* @__PURE__ */ new Map();
var defaultWeaponsByType = /* @__PURE__ */ new Map();
var summonBaseId = /* @__PURE__ */ new Map();
var skillBaseId = /* @__PURE__ */ new Map();
var summonRequirements = /* @__PURE__ */ new Map();
var playableRequirements = /* @__PURE__ */ new Map();
var skillRequirements = /* @__PURE__ */ new Map();
var mappedFrom = /* @__PURE__ */ new Map();
function setMapped(map, mapName, key, value) {
  const source = `${mapName}:${key}`;
  const existing = map.get(key);
  if (existing !== void 0 && JSON.stringify(existing) !== JSON.stringify(value)) {
    log.warn(`${mapName} overwriting ${key}`, { previous: existing, previousChain: mappedFrom.get(source), next: value });
  }
  map.set(key, value);
  mappedFrom.set(source, currentChain());
}
var CURRENT_SEASON = `${"g" /* Seasons */}0`;
function mapDollIdToWeaponId(weapon) {
  if (weapon.dollId) dollIdToWeaponId.set(weapon.dollId, weapon.id);
}
function mapDefaultWeaponTypes(weapon) {
  if (defaultWeaponsByType.has(weapon.gunType)) return;
  if (weapon.rarity === 3 /* Elite */ && !weapon.dollId) {
    defaultWeaponsByType.set(weapon.gunType, weapon.id);
  }
}
function findPlayableRequirement(summon) {
  const withKey = (key) => [summon.requiresKey, key].filter((k) => k !== void 0);
  const firstLevel = (levels) => Object.entries(levels ?? {}).filter(([, level2]) => level2.controllable).map(([n]) => Number(n)).sort((a, b) => a - b)[0];
  if (summon.controllable) return { keys: withKey() };
  const level = firstLevel(summon.levels);
  if (level !== void 0) return { keys: withKey(), minFortification: level };
  for (const [key, replacement] of Object.entries(summon.replacedBy ?? {})) {
    if (replacement.controllable) return { keys: withKey(key) };
    const replacementLevel = firstLevel(replacement.levels);
    if (replacementLevel !== void 0) return { keys: withKey(key), minFortification: replacementLevel };
  }
  return void 0;
}
function mapSummonsToDoll(doll) {
  var _stack3 = [];
  try {
    const _scope = __using(_stack3, logScope(`mapSummonsToDoll ${doll.id}`));
    for (const summon of doll.summons) {
      var _stack2 = [];
      try {
        const _summonScope = __using(_stack2, logScope(`summon ${summon.id}`));
        setMapped(summonIdToDollId, "summonIdToDollId", summon.id, { id: doll.id, fortification: 0 });
        summonBaseId.set(summon.id, summon.id);
        summonRequirements.set(summon.id, { ownerId: doll.id, name: summon.name, requiresKey: summon.requiresKey });
        const playable = findPlayableRequirement(summon);
        if (playable) playableRequirements.set(summon.id, playable);
        if (summon.levels) {
          for (const [levelId, level] of Object.entries(summon.levels)) {
            if (level.id) {
              summonBaseId.set(level.id, summon.id);
              setMapped(summonIdToDollId, "summonIdToDollId", level.id, { id: doll.id, fortification: Number(levelId) });
            }
          }
        }
        if (summon.replacedBy) {
          for (const [keyId, replacement] of Object.entries(summon.replacedBy)) {
            var _stack = [];
            try {
              const _replacementScope = __using(_stack, logScope(`replacedBy ${keyId}`));
              if (replacement.id) {
                summonBaseId.set(replacement.id, summon.id);
                setMapped(summonIdToDollId, "summonIdToDollId", replacement.id, { id: doll.id, fortification: 0, keyId });
              }
              if (replacement.levels) {
                for (const [levelId, level] of Object.entries(replacement.levels)) {
                  if (level.id) {
                    summonBaseId.set(level.id, summon.id);
                    setMapped(summonIdToDollId, "summonIdToDollId", level.id, {
                      id: doll.id,
                      fortification: Number(levelId),
                      keyId
                    });
                  }
                }
              }
            } catch (_) {
              var _error = _, _hasError = true;
            } finally {
              __callDispose(_stack, _error, _hasError);
            }
          }
        }
      } catch (_2) {
        var _error2 = _2, _hasError2 = true;
      } finally {
        __callDispose(_stack2, _error2, _hasError2);
      }
    }
  } catch (_3) {
    var _error3 = _3, _hasError3 = true;
  } finally {
    __callDispose(_stack3, _error3, _hasError3);
  }
}
function mapFixedKeysToDoll(doll) {
  for (const key of doll.keys) {
    if (key.type === 1 /* FixedKey */ || key.type === 3 /* ExpansionKey */) {
      fixedKeyIdToDollId.set(key.id, doll.id);
    }
  }
}
function mapSkillsToEntity(entity) {
  var _stack4 = [];
  try {
    const _scope = __using(_stack4, logScope(`mapSkillsToEntity ${entity.id}`));
    mapSkillIds(entity.skills, entity.id);
    if ("levels" in entity) {
      for (const [levelId, level] of Object.entries(entity.levels)) {
        var _stack = [];
        try {
          const _levelScope = __using(_stack, logScope(`level ${levelId}`));
          if (level.skills) {
            mapSkillIds(level.skills, entity.id, Number(levelId));
          }
        } catch (_) {
          var _error = _, _hasError = true;
        } finally {
          __callDispose(_stack, _error, _hasError);
        }
      }
    }
    if ("replacedBy" in entity) {
      for (const [keyId, replacement] of Object.entries(entity.replacedBy)) {
        var _stack3 = [];
        try {
          const _replacementScope = __using(_stack3, logScope(`replacedBy ${keyId}`));
          if (replacement.skills) {
            mapSkillIds(replacement.skills, entity.id, 0, keyId);
          }
          if ("levels" in replacement) {
            for (const [levelId, level] of Object.entries(replacement.levels)) {
              var _stack2 = [];
              try {
                const _levelScope = __using(_stack2, logScope(`level ${levelId}`));
                if (level.skills) {
                  mapSkillIds(level.skills, entity.id, Number(levelId), keyId);
                }
              } catch (_2) {
                var _error2 = _2, _hasError2 = true;
              } finally {
                __callDispose(_stack2, _error2, _hasError2);
              }
            }
          }
        } catch (_3) {
          var _error3 = _3, _hasError3 = true;
        } finally {
          __callDispose(_stack3, _error3, _hasError3);
        }
      }
    }
    if ("summons" in entity) {
      for (const summon of entity.summons) {
        mapSkillsToEntity(summon);
      }
    }
  } catch (_4) {
    var _error4 = _4, _hasError4 = true;
  } finally {
    __callDispose(_stack4, _error4, _hasError4);
  }
}
function mapSkillIds(skills, id, baseFortification = 0, keyId) {
  for (const skill of skills) {
    var _stack2 = [];
    try {
      const _skillScope = __using(_stack2, logScope(`skill ${skill.id}`));
      setMapped(skillIdToEntityId, "skillIdToEntityId", skill.id, { id, fortification: baseFortification, keyId });
      skillBaseId.set(skill.id, skill.id);
      skillRequirements.set(skill.id, {
        ownerId: id,
        name: skill.name,
        requiresKey: skill.requiresKey ?? keyId,
        minFortification: baseFortification || void 0
      });
      if (skill.levels) {
        for (const [levelId, level] of Object.entries(skill.levels)) {
          if (level.id) {
            skillBaseId.set(level.id, skill.id);
            setMapped(skillIdToEntityId, "skillIdToEntityId", level.id, { id, fortification: Number(levelId), keyId });
          }
        }
      }
      if (skill.replacedBy) {
        for (const [replacementKeyId, replacement] of Object.entries(skill.replacedBy)) {
          var _stack = [];
          try {
            const _replacementScope = __using(_stack, logScope(`replacedBy ${replacementKeyId}`));
            if (replacement.id) {
              skillBaseId.set(replacement.id, skill.id);
              setMapped(skillIdToEntityId, "skillIdToEntityId", replacement.id, {
                id,
                fortification: baseFortification,
                keyId: replacementKeyId
              });
            }
            if (replacement.levels) {
              for (const [levelId, level] of Object.entries(replacement.levels)) {
                if (level.id) {
                  skillBaseId.set(level.id, skill.id);
                  setMapped(skillIdToEntityId, "skillIdToEntityId", level.id, {
                    id,
                    fortification: Number(levelId),
                    keyId: replacementKeyId
                  });
                }
              }
            }
          } catch (_) {
            var _error = _, _hasError = true;
          } finally {
            __callDispose(_stack, _error, _hasError);
          }
        }
      }
    } catch (_2) {
      var _error2 = _2, _hasError2 = true;
    } finally {
      __callDispose(_stack2, _error2, _hasError2);
    }
  }
}
function summonBaseIdOf(id) {
  return summonBaseId.get(id) ?? id;
}
function skillBaseIdOf(id) {
  return skillBaseId.get(id) ?? id;
}
function isEverPlayable(id) {
  return playableRequirements.has(summonBaseIdOf(id));
}
function getPlayableRequirement(id) {
  const requirement = playableRequirements.get(summonBaseIdOf(id));
  if (!requirement) throw new Error(`Summon ${id} is never playable`);
  return requirement;
}
function missingSummonKey(summon, owner) {
  return summon.requiresKey && !owner.keys.includes(summon.requiresKey) ? summon.requiresKey : void 0;
}
function isSummonUnlocked(summon, owner) {
  return !!summon.controllable && missingSummonKey(summon, owner) === void 0;
}
function isKnownBuffId(id) {
  return id in combinedBuffs.data;
}
function isKnownWeaponId(id) {
  return id in combinedWeapons.data;
}
function isKnownKeyId(id) {
  return id in combinedKeys.data || fixedKeyIdToDollId.has(id);
}
function getKeyOwnerId(id) {
  if (!isKnownKeyId(id)) throw new Error(`Key ${String(id)} not found`);
  return fixedKeyIdToDollId.get(id);
}
function isKnownSummonId(id) {
  return summonIdToDollId.has(id);
}
function isKnownSkillId(id) {
  return id === V9_END_TURN_SKILL_ID || skillIdToEntityId.has(id);
}
function getSummonOwnerId(id) {
  const data = summonIdToDollId.get(id);
  if (!data) throw new Error(`Summon ${id} not found`);
  return data.id;
}
function getSummonRequirement(id) {
  const requirement = summonRequirements.get(summonBaseIdOf(id));
  if (!requirement) throw new Error(`Requirement for summon ${id} not found`);
  return requirement;
}
function getSkillTier(id) {
  const data = skillIdToEntityId.get(id);
  if (!data) throw new Error(`Skill ${id} not found`);
  return { fortification: data.fortification, keyId: data.keyId };
}
function getSummonTier(id) {
  const data = summonIdToDollId.get(id);
  if (!data) throw new Error(`Summon ${id} not found`);
  return { fortification: data.fortification, keyId: data.keyId };
}
function getSkillRequirement(id) {
  const requirement = skillRequirements.get(skillBaseIdOf(id));
  if (!requirement) throw new Error(`Requirement for skill ${id} not found`);
  return requirement;
}
function matchFamily(items, id, baseOf) {
  return items.find((item) => item.id === id) ?? items.find((item) => baseOf(item.id) === baseOf(id));
}
function hasSummonFamily(id, doll) {
  return matchFamily(doll.summons, id, (i) => summonBaseIdOf(i)) !== void 0;
}
function hasSkillFamily(id, entity) {
  return matchFamily(entity.skills, id, (i) => skillBaseIdOf(i)) !== void 0;
}
function resolveSummon2(id, doll) {
  const summon = matchFamily(doll.summons, id, (i) => summonBaseIdOf(i));
  if (!summon) throw new Error(`Summon ${id} not found on doll ${doll.id}`);
  return summon;
}
function resolveSkill2(id, entity) {
  const skill = matchFamily(entity.skills, id, (i) => skillBaseIdOf(i));
  if (!skill) throw new Error(`Skill ${id} not found on entity ${entity.id}`);
  return skill;
}
function getDollByDollOrSummon(dollOrSummon) {
  if (hasPrefix(dollOrSummon.id, "d" /* Dolls */)) {
    return dollOrSummon;
  } else if (hasPrefix(dollOrSummon.id, "m" /* Summons */)) {
    const data = summonIdToDollId.get(dollOrSummon.id);
    if (!data) throw new Error(`Summon ${dollOrSummon.id} to doll reference not found`);
    const selectedDoll3 = state.selectedDolls.find((s) => s.id === data.id);
    if (!selectedDoll3) throw new Error(`Doll ${data.id} is not an actively selected doll`);
    return getSelectedDoll(selectedDoll3);
  }
  throw new Error(`Invalid doll or summon id ${String(dollOrSummon.id)}`);
}
function isUnreleased(target) {
  if (getDollByDollOrSummon(target).unreleased) return true;
  if (!hasPrefix(target.id, "m" /* Summons */)) return false;
  const keyIds = [getSummonRequirement(target.id).requiresKey, getSummonTier(target.id).keyId];
  return keyIds.some((keyId) => keyId !== void 0 && getKeyById(keyId).unreleased === true);
}
function isInertSummon(target) {
  return hasPrefix(target.id, "m" /* Summons */) && target.skills.length === 0;
}
function getDollById(id) {
  return applyDollFortification({ id, fortification: 0, keys: [] });
}
function getSelectedDoll(sd, includeLocked = false) {
  return applyDollFortification(sd, includeLocked);
}
function getSelectedDollById(id) {
  const selectedDoll3 = state.selectedDolls.find((s) => s.id === id);
  if (!selectedDoll3) throw new Error(`Doll ${id} is not an actively selected doll`);
  return applyDollFortification(selectedDoll3);
}
function getDollChibiIconByWeapon(weapon) {
  if (!weapon.dollId) return "";
  const doll = getDollById(weapon.dollId);
  return doll.icons.chibi;
}
function getDollAvatarByKey(key) {
  if (!key.dollId) return "";
  const doll = getDollById(key.dollId);
  return doll.icons.avatar;
}
function getSummonById(id) {
  return resolveSummon2(id, getSelectedDollById(getSummonOwnerId(id)));
}
function getSummonIcon(id) {
  const loadout = summonIdToDollId.get(id);
  if (!loadout) return "";
  const doll = applyDollFortification({
    id: loadout.id,
    fortification: loadout.fortification,
    keys: loadout.keyId ? [loadout.keyId] : []
  });
  return matchFamily(doll.summons, id, (i) => summonBaseIdOf(i))?.icon ?? "";
}
function getSkillById(id) {
  if (id === V9_END_TURN_SKILL_ID) return endTurnSkill;
  const data = skillIdToEntityId.get(id);
  if (!data) throw new Error(`Skill ${id} not found`);
  return resolveSkill2(id, getEntityById(data.id));
}
function getFixedKeyById(id) {
  const keyId = fixedKeyIdToDollId.get(id);
  if (!keyId) throw new Error(`Fixed key ${id} not found`);
  const doll = getDollById(keyId);
  const keys = {};
  for (const key of doll.keys) {
    keys[key.id] = key;
  }
  return keys[id];
}
function getBuffById(id) {
  if (!combinedBuffs.data[id]) throw new Error(`Buff ${id} not found`);
  return combinedBuffs.data[id];
}
function getEnemyById(id) {
  if (!combinedEnemies.data[id]) throw new Error(`Enemy ${id} not found`);
  return combinedEnemies.data[id];
}
function getSharedKeyById(id) {
  if (!combinedKeys.data[id]) throw new Error(`Key ${id} not found`);
  return combinedKeys.data[id];
}
function getKeyById(id) {
  if (hasPrefix(id, "c" /* CommonKeys */, "a" /* AffinityKeys */)) {
    return getSharedKeyById(id);
  } else if (hasPrefix(id, "f" /* FixedKeys */)) {
    return getFixedKeyById(id);
  } else {
    throw new Error(`${String(id)} is probably not a key`);
  }
}
function hasExpansionKey(dollOrId) {
  const doll = typeof dollOrId === "string" ? getDollById(dollOrId) : dollOrId;
  for (const key of doll.keys) {
    if (key.type === 3 /* ExpansionKey */) return true;
  }
  return false;
}
function getSeasonById(id) {
  if (!combinedSeasons.data[id]) throw new Error(`Season ${id} not found`);
  return combinedSeasons.data[id];
}
function getWeaponById(id) {
  if (!combinedWeapons.data[id]) throw new Error(`Weapon ${id} not found`);
  return combinedWeapons.data[id];
}
function getWeaponByDollId(id) {
  const weaponId = dollIdToWeaponId.get(id);
  if (!weaponId) throw new Error(`Weapon for doll ${id} not found`);
  return getWeaponById(weaponId);
}
function hasPrefix(id, ...prefixes) {
  return prefixes.some((prefix) => id.startsWith(prefix));
}
function getEntityById(id) {
  if (hasPrefix(id, "d" /* Dolls */)) {
    const selectedDoll3 = state.selectedDolls.find((s) => s.id === id);
    if (!selectedDoll3) throw new Error(`Doll ${id} is not an actively selected doll`);
    return getSelectedDoll(selectedDoll3);
  } else if (hasPrefix(id, "m" /* Summons */)) {
    return getSummonById(id);
  } else if (hasPrefix(id, "e" /* Enemies */)) {
    return getEnemyById(id);
  }
  throw new Error(`Entity ${String(id)} not found`);
}
function getCurrentSeason() {
  return combinedSeasons.data[CURRENT_SEASON];
}
function getSortedUsableSkills(entity) {
  const manual = entity.skills.filter((s) => s.manual);
  const unordered = manual.filter((s) => !skillOrder.includes(s.type));
  if (unordered.length > 0) {
    throw new Error("Unable to match all skills to SkillOrder list");
  }
  return manual.sort((a, b) => skillOrder.indexOf(a.type) - skillOrder.indexOf(b.type));
}
function getEntitiesByIdBatch(batchIds) {
  const result = [];
  for (const id of batchIds) {
    if (hasPrefix(id, "d" /* Dolls */)) {
      result.push(getSelectedDollById(id));
    } else if (hasPrefix(id, "m" /* Summons */)) {
      result.push(getSummonById(id));
    } else {
      throw new Error(`Unknown ID ${String(id)} found in action order`);
    }
  }
  return result;
}
function getSelectedDollEntry(id) {
  const selectedDoll3 = state.selectedDolls.find((s) => s.id === id);
  if (!selectedDoll3) throw new Error(`Doll ${id} is not an actively selected doll`);
  return selectedDoll3;
}
function getActionBarEntities(batchIds) {
  const showLocked = localState.alwaysDisplaySkills;
  const result = [];
  for (const id of batchIds) {
    if (hasPrefix(id, "d" /* Dolls */)) {
      result.push(getSelectedDoll(getSelectedDollEntry(id), showLocked));
    } else if (hasPrefix(id, "m" /* Summons */)) {
      const owner = getSelectedDollEntry(getSummonOwnerId(id));
      const summon = resolveSummon2(id, getSelectedDoll(owner, showLocked));
      if (!isEverPlayable(summon.id)) continue;
      if (!showLocked && !isSummonUnlocked(summon, owner)) continue;
      result.push(summon);
    } else {
      throw new Error(`Unknown ID ${String(id)} found in action order`);
    }
  }
  return result;
}
function getSummonsFromSelectedDolls(selectedDolls) {
  const result = [];
  for (const sd of selectedDolls) {
    const doll = getSelectedDoll(sd);
    for (const summon of doll.summons) {
      result.push({ summon, owner: sd, missingKey: missingSummonKey(summon, sd) });
    }
  }
  return result;
}
function getSelectedDollAndSummonInfo(excludeIds = [], excludeUnplaced = false, tab = localState.currentTab) {
  const dolls = [];
  for (const sd of state.selectedDolls) {
    const doll = getSelectedDoll(sd);
    const includeDoll = excludeUnplaced ? isPlaced(doll.id, tab) : true;
    if (!excludeIds.includes(sd.id) && includeDoll) {
      dolls.push(doll);
    }
    for (const summon of doll.summons) {
      const includeSummon = excludeUnplaced ? isPlaced(summon.id, tab) : true;
      const isSelectable = !summon.unselectable;
      if (!excludeIds.includes(summon.id) && includeSummon && isSelectable) {
        dolls.push(summon);
      }
    }
  }
  return dolls;
}
function getTargetCandidates(ownerId, tab) {
  return getSelectedDollAndSummonInfo([ownerId], true, tab);
}
function needsAllyTarget(skill) {
  return skill.selects.includes(6 /* Ally */) || skill.selects.includes(8 /* OtherAlliedDoll */);
}
function getSelectedDollNamesAndFortifications() {
  const dolls = [];
  const sorted = state.selectedDolls.map((sd) => {
    const doll = getSelectedDoll(sd);
    return { fortification: sd.fortification, name: doll.name, borrow: sd.borrow };
  }).sort((a, b) => Number(b.borrow) - Number(a.borrow) || b.fortification - a.fortification || a.name.localeCompare(b.name));
  for (const sd of sorted) {
    dolls.push(`${sd.name} (V${sd.fortification})`);
  }
  return dolls;
}
function sortBuffs(buffId1, buffId2) {
  const known1 = isKnownBuffId(buffId1);
  const known2 = isKnownBuffId(buffId2);
  if (!known1 || !known2) return Number(known2) - Number(known1);
  const buff1 = getBuffById(buffId1);
  const buff2 = getBuffById(buffId2);
  const season = getSeasonById(CURRENT_SEASON);
  const coreBuffId = season.buffId;
  const seasonalBuffIds = Object.keys(season.dailyBuffIds);
  return Number(buffId2 === coreBuffId) - Number(buffId1 === coreBuffId) || Number(seasonalBuffIds.includes(buffId1)) - Number(seasonalBuffIds.includes(buffId2)) || seasonalBuffIds.indexOf(buffId1) - seasonalBuffIds.indexOf(buffId2) || buff1.name.localeCompare(buff2.name);
}
function setSkillDisplay(skillType, notationStyle) {
  const slot = getNotationSlot(skillType);
  const index = getNotations(skillType).indexOf(notationStyle);
  if (localState.skillDisplay[slot] === index) return;
  setLocalState(
    produce((s) => {
      s.skillDisplay[slot] = index;
    })
  );
}
function getSkillDisplay(skillType) {
  return getNotations(skillType)[localState.skillDisplay[getNotationSlot(skillType)] ?? 0];
}
async function loadGameData() {
  try {
    const res = await Promise.all([
      fetch("gfl2-data/attachments.json"),
      fetch("gfl2-data/buffs.json"),
      fetch("gfl2-data/dolls.json"),
      fetch("gfl2-data/enemies.json"),
      fetch("gfl2-data/keys.json"),
      fetch("gfl2-data/remoldingStats.json"),
      fetch("gfl2-data/seasons.json"),
      fetch("gfl2-data/weapons.json")
    ]);
    const attachments = await res[0].json();
    const buffs = await res[1].json();
    const dolls = await res[2].json();
    const enemies = await res[3].json();
    const keys = await res[4].json();
    const remoldingStats = await res[5].json();
    const seasons = await res[6].json();
    const weapons = await res[7].json();
    Object.assign(combinedAttachments.data, attachments.data);
    Object.assign(combinedBuffs.data, buffs.data);
    Object.assign(combinedDolls.data, dolls.data);
    Object.assign(combinedEnemies.data, enemies.data);
    Object.assign(combinedKeys.data, keys.data);
    Object.assign(combinedRemoldingStats.data, remoldingStats.data);
    Object.assign(combinedSeasons.data, seasons.data);
    Object.assign(combinedWeapons.data, weapons.data);
    const now = Date.now();
    let nearestEnd = Infinity;
    let latestEnd = -Infinity;
    let latestId = CURRENT_SEASON;
    for (const season of Object.values(combinedSeasons.data)) {
      const end = Date.parse(season.endTime);
      if (end > now && end < nearestEnd) {
        nearestEnd = end;
        CURRENT_SEASON = season.id;
      }
      if (end > latestEnd) {
        latestEnd = end;
        latestId = season.id;
      }
    }
    if (nearestEnd === Infinity) CURRENT_SEASON = latestId;
    for (const weapon of Object.values(combinedWeapons.data)) {
      mapDollIdToWeaponId(weapon);
      mapDefaultWeaponTypes(weapon);
    }
    for (const doll of Object.values(combinedDolls.data)) {
      mapSummonsToDoll(doll);
      mapFixedKeysToDoll(doll);
      mapSkillsToEntity(doll);
    }
  } catch (e) {
    console.error(e);
  }
}

// src/store/uiState.ts
var [loaded, setLoaded] = createSignal(false);
var [showDollModal, setShowDollModal] = createSignal(false);
var [showFormationModal, setShowFormationModal] = createSignal(false);
var [showWeaponModal, setShowWeaponModal] = createSignal(false);
var [showKeyModal, setShowKeyModal] = createSignal(false);
var [showBuffModal, setShowBuffModal] = createSignal(false);
var hideFormationModal = createMemo(() => showWeaponModal() || showKeyModal());
var [selectedDoll, setSelectedDoll] = createSignal(null);
var [keyFocus, setKeyFocus] = createSignal(null);
var [showImportModal, setShowImportModal] = createSignal(false);
var [showExportModal, setShowExportModal] = createSignal(false);
var [showSkillDisplayModal, setShowSkillDisplayModal] = createSignal(false);
var [showIssuesModal, setShowIssuesModal] = createSignal(false);
var [showEffectModal, setShowEffectModal] = createSignal(false);
var [effectModalEffects, setEffectModalEffects] = createSignal([]);
var [effectModalPosition, setEffectModalPosition] = createSignal({ x: 0, y: 0 });
var [showTargetModal, setShowTargetModal] = createSignal(false);
var [targetSkillInfo, setTargetSkillInfo] = createSignal("");
var [targetDollId, setTargetDollId] = createSignal(null);
var [targetSkillId, setTargetSkillId] = createSignal(null);
var [retargetAction, setRetargetAction] = createSignal(null);
var [activePhaseTab, setActivePhaseTab] = createSignal(8 /* All */);
var [dollFortification, setDollFortification] = createSignal({});
var [stateHashMatch, setStateHashMatch] = createSignal(false);
var [stateFromURL, setStateFromURL] = createSignal(false);
var [importErrors, setImportErrors] = createSignal([]);
function pushImportError(report) {
  setImportErrors((reports) => [...reports, report]);
}
var [zoom, setZoom] = createSignal(2);
var [coords, setCoords] = createSignal("");
var [offsetX, setOffsetX] = createSignal(0);
var [offsetY, setOffsetY] = createSignal(0);
function isVisible(phase) {
  return activePhaseTab() === 8 /* All */ || phase === activePhaseTab() || phase === 7 /* Resonance */ && activePhaseTab() !== 1 /* Physical */;
}
function visibleDollIndex(doll) {
  const dolls = Object.values(combinedDolls.data).filter((d) => isVisible(d.phase));
  const index = dolls.findIndex((d) => d.id === doll.id);
  if (index === -1) return Object.values(combinedDolls.data).length;
  return index;
}

// src/components/TabBar.tsx
var _tmpl$47 = /* @__PURE__ */ template(`<div class="flex flex-row gap-1.5 p-1">`);
var _tmpl$216 = /* @__PURE__ */ template(`<div class="flex items-center justify-between gap-1 overflow-x-auto border-t border-[#E06C28] bg-[#C7C5CE] px-4 py-2"><div class="flex gap-3"><button>Map Editor</button><div class="mx-1 h-6 w-px self-center bg-zinc-700"></div><div class="flex gap-0"></div><button>Summary</button></div><div class="flex flex-row items-center gap-2"><div>`);
var _tmpl$311 = /* @__PURE__ */ template(`<button>`);
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
    setLocalState(produce((s) => {
      s.currentTab = newTab;
    }));
    props.onTabChange(newTab);
  };
  const isActionTab = createMemo(() => localState.currentTab >= 1 && localState.currentTab <= 7);
  const copyPreviousPlacements = () => {
    if (localState.currentTab <= 0) {
      alert("No previous tab!");
      return;
    }
    const prev = localState.currentTab - 1;
    setState(produce((s) => {
      const curTab = s.tabData[localState.currentTab];
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
    var _el$ = _tmpl$216(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling, _el$7 = _el$2.nextSibling, _el$9 = _el$7.firstChild;
    _el$3.$$click = () => {
      switchToTab(-1);
    };
    insert(_el$5, createComponent(For, {
      get each() {
        return Array.from({
          length: 8
        }, (_, i) => i);
      },
      children: (i) => (() => {
        var _el$0 = _tmpl$311();
        _el$0.$$click = () => {
          switchToTab(i);
        };
        insert(_el$0, i === 0 ? "Setup" : i);
        createRenderEffect(() => className(_el$0, `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${localState.currentTab === i ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"}`));
        return _el$0;
      })()
    }));
    _el$6.$$click = () => {
      switchToTab(8);
    };
    insert(_el$7, createComponent(Show, {
      get when() {
        return localState.currentTab === 8;
      },
      get children() {
        var _el$8 = _tmpl$47();
        insert(_el$8, createComponent(Button, {
          onClick: () => setShowExportModal(true),
          color: "dark",
          design: "custom",
          content: "Export / Share"
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
          content: "Options"
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
    insert(_el$7, createComponent(Show, {
      get when() {
        return memo(() => !!loaded())() && saveIssueGroups().length;
      },
      get children() {
        return createComponent(Button, {
          onClick: () => setShowIssuesModal(true),
          color: "red",
          design: "custom",
          content: "Fix Issues",
          get badge() {
            return saveIssueGroups().length;
          }
        });
      }
    }), _el$9);
    createRenderEffect((_p$) => {
      var _v$ = `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold whitespace-nowrap transition-all ${localState.currentTab === -1 ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`, _v$2 = `flex h-13 flex-1 cursor-pointer items-center justify-center gap-1 rounded-t-sm border-b-4 px-3 pt-3 pb-2 text-2xl font-bold transition-all ${localState.currentTab === 8 ? "border-[#F26C1C] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-transparent text-[#384B53] hover:border-[#606164]"}`, _v$3 = `${interactiveStyles(false)} h-6 w-6 rounded-full ${stateStyle().color}`, _v$4 = stateStyle().text;
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
var _tmpl$48 = /* @__PURE__ */ template(`<div class=flex>`);
var _tmpl$217 = /* @__PURE__ */ template(`<div class="flex h-full gap-3 overflow-hidden bg-zinc-950 p-3.75">`);
var _tmpl$312 = /* @__PURE__ */ template(`<div class="relative min-w-0 flex-1 overflow-hidden rounded-sm"><canvas></canvas><div class="absolute top-3 right-3 flex gap-1.5"></div><div class="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-3xl bg-black/80 px-4 py-1.5 font-mono text-xs leading-normal text-lime-400">`);
var _tmpl$49 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-40"><div class="gf-card absolute flex w-56 flex-col gap-2 text-sm"><div class=font-bold>Spawn priority</div><div class="grid grid-cols-6 gap-1">`);
var _tmpl$56 = /* @__PURE__ */ template(`<button>`);
var _tmpl$63 = /* @__PURE__ */ template(`<div class="flex h-9 shrink-0 items-center self-stretch bg-[#384B53] px-3 font-bold tracking-wide text-[#ECECEC]">`);
var _tmpl$72 = /* @__PURE__ */ template(`<button type=button>`);
var _tmpl$82 = /* @__PURE__ */ template(`<label class="flex items-center gap-1.5"><span></span><input type=number class="input w-16 grow-0">`);
var _tmpl$92 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2 px-3 pb-3 text-[#1C2A32]"><div class="px-1 text-sm font-bold text-[#384B53]">Custom maps are saved in your browser. You can export a timeline with a custom map.`);
var _tmpl$0 = /* @__PURE__ */ template(`<div class="flex flex-1 items-start justify-center overflow-y-auto">`);
var _tmpl$1 = /* @__PURE__ */ template(`<div class="text-sm text-[#f87171]">`);
var _tmpl$102 = /* @__PURE__ */ template(`<div class="gf-card flex flex-col gap-2">`);
var _tmpl$112 = /* @__PURE__ */ template(`<div class="flex items-center gap-3"><span class=font-bold>Slot </span><span class="flex-1 text-[#9AA3A8] italic">Empty`);
var _tmpl$122 = /* @__PURE__ */ template(`<div class="flex items-center gap-3"><span class=font-bold>Slot </span><div class="flex min-w-0 flex-1 flex-col"><span class="truncate text-lg font-bold"></span><span class="text-xs text-[#9AA3A8]">\xD7<!> \xB7 <!> spawns, <!> numbered`);
var _tmpl$132 = /* @__PURE__ */ template(`<div class="flex items-center gap-2"><input class=input maxlength=40>`);
var _tmpl$142 = /* @__PURE__ */ template(`<div class="flex items-center gap-4">`);
var _tmpl$152 = /* @__PURE__ */ template(`<div class=text-[#f87171]>`);
var _tmpl$162 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2 border-t border-[#384B53] pt-2 text-sm"><div class="flex gap-1"></div><label class="flex items-center gap-2"><span>Name</span><input class=input maxlength=40></label><div class="flex justify-end gap-2">`);
var _tmpl$172 = /* @__PURE__ */ template(`<div class=text-[#AE4749]>`);
var _tmpl$182 = /* @__PURE__ */ template(`<textarea readonly class="h-32 min-h-20 resize-y rounded-sm bg-zinc-950 p-2 font-mono text-xs text-[#9ab0c0]">`);
var _tmpl$192 = /* @__PURE__ */ template(`<div class=text-[#AE4749]>Import error: `);
var _tmpl$202 = /* @__PURE__ */ template(`<div class="flex min-h-0 flex-1 flex-col"><div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-2 text-sm text-[#1C2A32] *:shrink-0"><div class="gf-card flex items-center gap-2"><div class="flex min-w-0 flex-1 flex-col"><span class="truncate text-lg font-bold"></span><span class="text-xs text-[#9AA3A8]">Slot <!> \xB7 <!>\xD7</span></div></div><div class="grid grid-cols-2 gap-1.5"></div><div class="px-1 font-bold text-[#384B53]"> of <!> spawns numbered. You can assign priority to spawn tiles with the priority tool. Left click to assign in order, or right click to assign a specific number.</div><label class="flex items-center gap-2 font-bold"><span>Name</span><input class=input maxlength=40></label><div class="flex items-center gap-3 font-bold"><div class="flex flex-col gap-1.5"></div><div class="flex flex-col items-center gap-0.5"><div class="grid grid-cols-3 gap-0.5"title="Which side stays in place when the map grows or shrinks"></div><span class=text-xs>Anchor</span></div></div><div class="flex gap-2"></div><textarea placeholder="Paste map JSON to import into this slot..."class="h-32 min-h-20 resize-y rounded-sm bg-zinc-950 p-2 font-mono text-xs text-[#9ab0c0]"></textarea></div><div class="border-t-3 border-[#B5B5B6] px-3 pt-1.5 text-xs font-bold text-[#384B53]">`);
var _tmpl$218 = /* @__PURE__ */ template(`<button type=button><span class="h-3 w-3 shrink-0 rounded-xs">`);
var HINT = "Left-click / drag to place \xB7 Right-click a spawn to set its priority, anything else to erase \xB7 Scroll or pinch to zoom";
var [tool, setTool] = createSignal("spawn");
var [status, setStatus] = createSignal(HINT);
var [coords2, setCoords2] = createSignal("");
var [revision, setRevision] = createSignal(0);
var [rankPopup, setRankPopup] = createSignal(null);
var canvasEl2;
var ctx2;
var painting = null;
var dirty = false;
var lastPaint = {
  x: -1,
  y: -1
};
var view = {
  x: 0,
  y: 0,
  scale: 1
};
var MIN_ZOOM = 0.15;
var MAX_ZOOM = 6;
var dpr2 = 1;
var needsFit = true;
function logicalSize() {
  return {
    w: mapGrid.width * TILE_SIZE + 2 * E_PAD,
    h: mapGrid.height * TILE_SIZE + 2 * E_PAD
  };
}
function fitView() {
  if (!canvasEl2?.clientWidth || !canvasEl2.clientHeight) return;
  const {
    w,
    h
  } = logicalSize();
  view.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(canvasEl2.clientWidth / w, canvasEl2.clientHeight / h)));
  view.x = mapGrid.width * TILE_SIZE / 2;
  view.y = mapGrid.height * TILE_SIZE / 2;
  needsFit = false;
}
function clampView() {
  view.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale));
  view.x = Math.min(mapGrid.width * TILE_SIZE, Math.max(0, view.x));
  view.y = Math.min(mapGrid.height * TILE_SIZE, Math.max(0, view.y));
}
function sizeCanvas() {
  if (!canvasEl2) return;
  dpr2 = window.devicePixelRatio || 1;
  const width = Math.round(canvasEl2.clientWidth * dpr2);
  const height = Math.round(canvasEl2.clientHeight * dpr2);
  if (canvasEl2.width !== width || canvasEl2.height !== height) {
    canvasEl2.width = width;
    canvasEl2.height = height;
  }
}
function editorRender() {
  if (!ctx2 || !canvasEl2) return;
  sizeCanvas();
  if (needsFit) fitView();
  ctx2.setTransform(1, 0, 0, 1, 0, 0);
  ctx2.clearRect(0, 0, canvasEl2.width, canvasEl2.height);
  const s = view.scale * dpr2;
  ctx2.setTransform(s, 0, 0, s, canvasEl2.width / 2 - view.x * s, canvasEl2.height / 2 - view.y * s);
  drawMapTilesOnArena(ctx2, null, -1);
}
function toWorld(clientX, clientY) {
  if (!canvasEl2) return {
    x: -1,
    y: -1
  };
  const rect = canvasEl2.getBoundingClientRect();
  return {
    x: (clientX - rect.left - rect.width / 2) / view.scale + view.x,
    y: (clientY - rect.top - rect.height / 2) / view.scale + view.y
  };
}
function zoomAt2(clientX, clientY, factor) {
  const before = toWorld(clientX, clientY);
  view.scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.scale * factor));
  const after = toWorld(clientX, clientY);
  view.x += before.x - after.x;
  view.y += before.y - after.y;
  clampView();
  editorRender();
}
function zoomCentre(factor) {
  if (!canvasEl2) return;
  const rect = canvasEl2.getBoundingClientRect();
  zoomAt2(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}
function panBy(dx, dy) {
  view.x -= dx / view.scale;
  view.y -= dy / view.scale;
  clampView();
  editorRender();
}
function commit() {
  const slot = editingSlot();
  if (slot === null) return;
  saveSlot(slot, mapGrid);
  setRevision((r) => r + 1);
}
function editorHit(e) {
  const world = toWorld(e.clientX, e.clientY);
  return {
    c: Math.floor(world.x / TILE_SIZE),
    r: Math.floor(world.y / TILE_SIZE)
  };
}
function snapshot() {
  return mapGrid.tiles.join() + "|" + mapGrid.priority.join();
}
function applyTool(c, r, active) {
  if (!inMapBounds(c, r)) return;
  const before = snapshot();
  if (active === "boss") {
    if (c + 1 >= mapGrid.width || r + 1 >= mapGrid.height) return;
    if (c - 1 < 0 || r - 1 < 0) return;
    for (let dr = -1; dr < 2; dr++) for (let dc = -1; dc < 2; dc++) if (hasCover(c + dc, r + dr)) return;
    unsetBoss();
    for (let dr = -1; dr < 2; dr++) {
      for (let dc = -1; dc < 2; dc++) {
        setCell(c + dc, r + dr, 32 /* BossCover */);
      }
    }
    setCell(c, r, 64 /* BossOrigin */);
  } else if (active === "hcov") {
    setCell(c, r, 8 /* HalfCover */);
  } else if (active === "fcov") {
    setCell(c, r, 16 /* FullCover */);
  } else if (active === "spawn") {
    if (!hasCover(c, r)) setCell(c, r, 1 /* Spawn */, true);
  } else if (active === "hbnd_h") {
    if (!inMapBounds(c, r + 1) || hasCover(c, r) || hasCover(c, r + 1)) return;
    setCell(c, r, 2 /* HBoundary */, true);
    setCell(c, r + 1, 2 /* HBoundary */, true);
  } else if (active === "hbnd_v") {
    if (!inMapBounds(c + 1, r) || hasCover(c, r) || hasCover(c + 1, r)) return;
    setCell(c, r, 4 /* VBoundary */, true);
    setCell(c + 1, r, 4 /* VBoundary */, true);
  } else if (active === "priority") {
    const index = gridKey(c, r);
    if (!isTileType(getCell(c, r), 1 /* Spawn */)) return;
    setPriority(index, mapGrid.priority.includes(index) ? null : mapGrid.priority.length + 1);
  } else if (active === "erase") {
    const cell = getCell(c, r);
    if (isTileType(cell, 32 /* BossCover */) || isTileType(cell, 64 /* BossOrigin */)) {
      unsetBoss();
    } else {
      setCell(c, r, 0 /* Empty */);
    }
  }
  if (snapshot() !== before) dirty = true;
  editorRender();
}
var TOOL_BUTTONS = [{
  tool: "spawn",
  label: "Spawn",
  color: "#0d2060",
  border: "#3060cc"
}, {
  tool: "priority",
  label: "Priority",
  color: "#4888ff",
  border: "#a8c4ff"
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
  border: "#777"
}, {
  tool: "zoom",
  label: "Pan / Zoom",
  color: "#3a4246",
  border: "#C9C8CE"
}];
var pointers = /* @__PURE__ */ new Map();
var panning = false;
var pendingTouch = null;
function pinch() {
  const [a, b] = [...pointers.values()];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    distance: Math.hypot(a.x - b.x, a.y - b.y)
  };
}
function handlePointerDown2(e) {
  e.preventDefault();
  pointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });
  canvasEl2?.setPointerCapture(e.pointerId);
  if (pointers.size === 2) {
    pendingTouch = null;
    finishStroke();
    panning = false;
    return;
  }
  if (pointers.size > 2) return;
  if (e.button === 1 || e.button === 0 && tool() === "zoom") {
    panning = true;
    return;
  }
  const h = editorHit(e);
  if (!inMapBounds(h.c, h.r)) return;
  if (e.button === 2) {
    if (isTileType(getCell(h.c, h.r), 1 /* Spawn */)) {
      setRankPopup({
        index: gridKey(h.c, h.r),
        x: e.clientX,
        y: e.clientY
      });
      return;
    }
    startStroke(h.c, h.r, "erase");
  } else if (e.button === 0) {
    if (e.pointerType === "touch") {
      pendingTouch = {
        c: h.c,
        r: h.r,
        tool: tool()
      };
      return;
    }
    if (tool() === "priority") {
      applyTool(h.c, h.r, "priority");
      finishStroke();
      return;
    }
    startStroke(h.c, h.r, tool());
  }
}
function startStroke(c, r, active) {
  painting = active;
  applyTool(c, r, active);
  lastPaint.x = c;
  lastPaint.y = r;
}
function handlePointerMove2(e) {
  const previous = pointers.get(e.pointerId);
  if (previous && pointers.size === 2) {
    const before = pinch();
    pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY
    });
    const after = pinch();
    if (before.distance > 0) zoomAt2(after.x, after.y, after.distance / before.distance);
    panBy(after.x - before.x, after.y - before.y);
    return;
  }
  if (previous) pointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY
  });
  if (previous && panning) {
    panBy(e.clientX - previous.x, e.clientY - previous.y);
    return;
  }
  const pos = editorHit(e);
  if (!inMapBounds(pos.c, pos.r)) return;
  setCoords2(`${String(pos.r).padStart(2, "0")},${String(pos.c).padStart(2, "0")}`);
  if (pendingTouch && pendingTouch.tool !== "priority" && (pendingTouch.c !== pos.c || pendingTouch.r !== pos.r)) {
    const {
      c,
      r,
      tool: active
    } = pendingTouch;
    pendingTouch = null;
    startStroke(c, r, active);
  }
  if (!painting || lastPaint.x === pos.c && lastPaint.y === pos.r) return;
  applyTool(pos.c, pos.r, painting);
  lastPaint.x = pos.c;
  lastPaint.y = pos.r;
}
function handlePointerUp2(e) {
  pointers.delete(e.pointerId);
  if (pendingTouch) {
    const {
      c,
      r,
      tool: active
    } = pendingTouch;
    pendingTouch = null;
    applyTool(c, r, active);
  }
  if (pointers.size === 1) panning = true;
  if (pointers.size === 0) panning = false;
  finishStroke();
}
function handleWheel2(e) {
  e.preventDefault();
  zoomAt2(e.clientX, e.clientY, Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 2e-3));
}
function finishStroke() {
  painting = null;
  lastPaint.x = -1;
  lastPaint.y = -1;
  if (!dirty) return;
  dirty = false;
  commit();
}
function openSlot(index) {
  const map = index === null ? null : slots()[index];
  if (index !== null && !map) {
    setEditingSlot(null);
    return;
  }
  if (map) fillGrid(map);
  needsFit = true;
  setRevision((r) => r + 1);
  setStatus(HINT);
  editorRender();
}
function EditorView() {
  createEffect(on(editingSlot, openSlot));
  onCleanup(() => {
    finishStroke();
    ctx2 = void 0;
    canvasEl2 = void 0;
    const map = findMap(state.map);
    if (map) fillGrid(map);
  });
  return (() => {
    var _el$ = _tmpl$217();
    insert(_el$, createComponent(Show, {
      get when() {
        return editingSlot() !== null;
      },
      get fallback() {
        return createComponent(SlotPicker, {});
      },
      get children() {
        return [(() => {
          var _el$2 = _tmpl$48();
          insert(_el$2, createComponent(Modal, {
            width: "w-(--sidebar-width)",
            get children() {
              return createComponent(EditorSidebar, {});
            }
          }));
          return _el$2;
        })(), createComponent(EditorCanvas, {}), createComponent(RankPopup, {})];
      }
    }));
    return _el$;
  })();
}
function EditorCanvas() {
  let el;
  onMount(() => {
    canvasEl2 = el;
    ctx2 = el.getContext("2d") ?? void 0;
    const observer = new ResizeObserver(() => {
      editorRender();
    });
    observer.observe(el);
    el.addEventListener("wheel", handleWheel2, {
      passive: false
    });
    onCleanup(() => {
      observer.disconnect();
      el.removeEventListener("wheel", handleWheel2);
      pointers.clear();
      panning = false;
      pendingTouch = null;
    });
    needsFit = true;
    editorRender();
  });
  return (() => {
    var _el$3 = _tmpl$312(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.nextSibling;
    _el$4.$$contextmenu = (e) => {
      e.preventDefault();
    };
    _el$4.addEventListener("pointerleave", () => {
      setCoords2("");
    });
    _el$4.addEventListener("pointercancel", handlePointerUp2);
    _el$4.$$pointerup = handlePointerUp2;
    _el$4.$$pointermove = handlePointerMove2;
    _el$4.$$pointerdown = handlePointerDown2;
    var _ref$ = el;
    typeof _ref$ === "function" ? use(_ref$, _el$4) : el = _el$4;
    insert(_el$5, createComponent(SmallButton, {
      onClick: () => {
        zoomCentre(1 / 1.25);
      },
      children: "\u2212"
    }), null);
    insert(_el$5, createComponent(SmallButton, {
      onClick: () => {
        needsFit = true;
        editorRender();
      },
      children: "Fit"
    }), null);
    insert(_el$5, createComponent(SmallButton, {
      onClick: () => {
        zoomCentre(1.25);
      },
      children: "+"
    }), null);
    insert(_el$6, () => coords2() || "--,--");
    createRenderEffect(() => className(_el$4, `absolute inset-0 block h-full w-full touch-none ${tool() === "zoom" ? "cursor-grab" : "cursor-crosshair"}`));
    return _el$3;
  })();
}
function RankPopup() {
  const ranked = () => {
    const popup = rankPopup();
    return popup ? mapGrid.priority.indexOf(popup.index) + 1 : 0;
  };
  const count = () => mapGrid.priority.length + (ranked() ? 0 : 1);
  const pick = (rank) => {
    const popup = rankPopup();
    setRankPopup(null);
    if (!popup) return;
    setPriority(popup.index, rank);
    editorRender();
    commit();
  };
  return createComponent(Show, {
    get when() {
      return rankPopup();
    },
    children: (popup) => (() => {
      var _el$7 = _tmpl$49(), _el$8 = _el$7.firstChild, _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling;
      _el$7.$$contextmenu = (e) => {
        e.preventDefault();
      };
      _el$7.$$pointerdown = () => setRankPopup(null);
      _el$8.$$pointerdown = (e) => {
        e.stopPropagation();
      };
      insert(_el$0, createComponent(For, {
        get each() {
          return Array.from({
            length: count()
          }, (_, i) => i + 1);
        },
        children: (rank) => (() => {
          var _el$1 = _tmpl$56();
          _el$1.$$click = () => {
            pick(rank);
          };
          insert(_el$1, rank);
          createRenderEffect(() => className(_el$1, `h-7 cursor-pointer rounded-sm font-bold ${rank === ranked() ? "bg-[#F0AF16] text-[#1C2A32]" : "bg-[#384B53] text-[#EFEFEF] hover:bg-[#52575a]"}`));
          return _el$1;
        })()
      }));
      insert(_el$8, createComponent(Show, {
        get when() {
          return ranked();
        },
        get children() {
          return createComponent(SmallButton, {
            color: "red",
            onClick: () => {
              pick(null);
            },
            children: "Remove number"
          });
        }
      }), null);
      createRenderEffect((_p$) => {
        var _v$ = `${Math.min(popup().x, window.innerWidth - 240)}px`, _v$2 = `${Math.min(popup().y, window.innerHeight - 200)}px`;
        _v$ !== _p$.e && setStyleProperty(_el$8, "left", _p$.e = _v$);
        _v$2 !== _p$.t && setStyleProperty(_el$8, "top", _p$.t = _v$2);
        return _p$;
      }, {
        e: void 0,
        t: void 0
      });
      return _el$7;
    })()
  });
}
function SectionHeader(props) {
  return (() => {
    var _el$10 = _tmpl$63();
    insert(_el$10, () => props.children);
    return _el$10;
  })();
}
function SmallButton(props) {
  const colors = () => props.color === "red" ? "bg-[#944040] text-[#EFEFEF]" : props.color === "light" ? "bg-[#C9C8CE] text-[#1C2A32]" : "bg-[#1C2A32] text-[#EFEFEF]";
  return (() => {
    var _el$11 = _tmpl$72();
    _el$11.$$click = () => {
      props.onClick();
    };
    insert(_el$11, () => props.children);
    createRenderEffect((_p$) => {
      var _v$3 = props.disabled, _v$4 = `${colors()} ${props.class ?? ""} flex h-8 items-center justify-center rounded-sm px-3 text-sm font-bold whitespace-nowrap shadow-sm shadow-black/50 ${props.disabled ? "cursor-default opacity-50" : "cursor-pointer outline-2 outline-transparent transition duration-250 hover:outline-white hover:duration-0"}`;
      _v$3 !== _p$.e && (_el$11.disabled = _p$.e = _v$3);
      _v$4 !== _p$.t && className(_el$11, _p$.t = _v$4);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$11;
  })();
}
function NumberInput(props) {
  return (() => {
    var _el$12 = _tmpl$82(), _el$13 = _el$12.firstChild, _el$14 = _el$13.nextSibling;
    insert(_el$13, () => props.label);
    _el$14.$$input = (e) => {
      props.onInput(e.currentTarget.valueAsNumber);
    };
    setAttribute(_el$14, "min", MIN_MAP_SIZE);
    setAttribute(_el$14, "max", MAX_MAP_SIZE);
    createRenderEffect(() => _el$14.value = props.value);
    return _el$12;
  })();
}
function sizeProblem(width, height) {
  const ok = (n) => Number.isInteger(n) && n >= MIN_MAP_SIZE && n <= MAX_MAP_SIZE;
  return ok(width) && ok(height) ? null : `Width and height must be from ${MIN_MAP_SIZE} to ${MAX_MAP_SIZE}`;
}
function spawnCount(map) {
  return map.tiles.filter((tile) => isTileType(tile, 1 /* Spawn */)).length;
}
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => setStatus("Copied to clipboard"), () => setStatus("Couldn't copy to the clipboard; select the text and copy it instead"));
}
function SlotPicker() {
  return (() => {
    var _el$15 = _tmpl$0();
    insert(_el$15, createComponent(Modal, {
      width: "w-180",
      get children() {
        return [createComponent(ModalHeader, {
          title: "Map Editor"
        }), (() => {
          var _el$16 = _tmpl$92(), _el$17 = _el$16.firstChild;
          insert(_el$16, createComponent(SectionHeader, {
            children: "Choose a slot to edit"
          }), _el$17);
          insert(_el$16, createComponent(For, {
            get each() {
              return Array.from({
                length: MAP_SLOT_COUNT
              }, (_, i) => i);
            },
            children: (index) => createComponent(SlotCard, {
              index
            })
          }), null);
          return _el$16;
        })()];
      }
    }));
    return _el$15;
  })();
}
function SlotCard(props) {
  const map = () => slots()[props.index];
  const [creating, setCreating] = createSignal(false);
  const [renaming, setRenaming] = createSignal(false);
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  const [confirmClear, setConfirmClear] = createSignal(false);
  const rename = () => {
    const current = map();
    if (!current) return;
    const problem = mapNameProblem(name(), props.index);
    if (problem) {
      setError(problem);
      return;
    }
    saveSlot(props.index, {
      ...current,
      name: name().trim()
    });
    setRenaming(false);
    setError("");
  };
  return (() => {
    var _el$18 = _tmpl$102();
    insert(_el$18, createComponent(Show, {
      get when() {
        return map();
      },
      get fallback() {
        return [(() => {
          var _el$20 = _tmpl$112(), _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild, _el$23 = _el$21.nextSibling;
          insert(_el$21, () => props.index + 1, null);
          insert(_el$20, createComponent(Show, {
            get when() {
              return !creating();
            },
            get children() {
              return createComponent(SmallButton, {
                color: "light",
                onClick: () => setCreating(true),
                children: "New map"
              });
            }
          }), null);
          return _el$20;
        })(), createComponent(Show, {
          get when() {
            return creating();
          },
          get children() {
            return createComponent(NewMapForm, {
              get index() {
                return props.index;
              },
              onCancel: () => setCreating(false)
            });
          }
        })];
      },
      children: (current) => [(() => {
        var _el$24 = _tmpl$122(), _el$25 = _el$24.firstChild, _el$26 = _el$25.firstChild, _el$27 = _el$25.nextSibling, _el$28 = _el$27.firstChild, _el$29 = _el$28.nextSibling, _el$30 = _el$29.firstChild, _el$35 = _el$30.nextSibling, _el$31 = _el$35.nextSibling, _el$36 = _el$31.nextSibling, _el$32 = _el$36.nextSibling, _el$37 = _el$32.nextSibling, _el$33 = _el$37.nextSibling;
        insert(_el$25, () => props.index + 1, null);
        insert(_el$28, () => current().name);
        insert(_el$29, () => current().width, _el$30);
        insert(_el$29, () => current().height, _el$35);
        insert(_el$29, () => spawnCount(current()), _el$36);
        insert(_el$29, () => current().priority.length, _el$37);
        insert(_el$29, createComponent(Show, {
          get when() {
            return timelineSlot() === props.index;
          },
          children: " \xB7 used by this timeline"
        }), null);
        insert(_el$24, createComponent(SmallButton, {
          color: "light",
          onClick: () => setEditingSlot(props.index),
          children: "Edit"
        }), null);
        insert(_el$24, createComponent(SmallButton, {
          onClick: () => {
            setName(current().name);
            setError("");
            setRenaming(!renaming());
          },
          children: "Rename"
        }), null);
        insert(_el$24, createComponent(SmallButton, {
          color: "red",
          onClick: () => setConfirmClear(true),
          children: "Clear"
        }), null);
        return _el$24;
      })(), createComponent(Show, {
        get when() {
          return renaming();
        },
        get children() {
          var _el$38 = _tmpl$132(), _el$39 = _el$38.firstChild;
          _el$39.$$keydown = (e) => {
            if (e.key === "Enter") rename();
          };
          _el$39.$$input = (e) => setName(e.currentTarget.value);
          insert(_el$38, createComponent(SmallButton, {
            color: "light",
            onClick: rename,
            children: "Save"
          }), null);
          insert(_el$38, createComponent(SmallButton, {
            onClick: () => setRenaming(false),
            children: "Cancel"
          }), null);
          createRenderEffect(() => _el$39.value = name());
          return _el$38;
        }
      }), createComponent(ConfirmModal, {
        get mount() {
          return document.querySelector("#body") ?? document.body;
        },
        title: "Clear slot",
        get content() {
          return `Delete "${current().name}" from slot ${props.index + 1}?`;
        },
        isActive: confirmClear,
        setActive: setConfirmClear,
        onClick: () => {
          clearSlot(props.index);
        }
      })]
    }), null);
    insert(_el$18, createComponent(Show, {
      get when() {
        return error();
      },
      get children() {
        var _el$19 = _tmpl$1();
        insert(_el$19, error);
        return _el$19;
      }
    }), null);
    return _el$18;
  })();
}
function NewMapForm(props) {
  const sources = createMemo(() => [...builtInMaps().map((map) => ({
    label: map.name,
    map
  })), ...slots().flatMap((map, i) => map ? [{
    label: slotLabel(i, map),
    map
  }] : [])]);
  const [mode, setMode] = createSignal("blank");
  const [name, setName] = createSignal(uniqueMapName("Custom Map"));
  const [width, setWidth] = createSignal(15);
  const [height, setHeight] = createSignal(15);
  const [source, setSource] = createSignal(sources()[0].label);
  const [error, setError] = createSignal("");
  const sourceMap = () => sources().find((s) => s.label === source())?.map;
  const pickMode = (next) => {
    setMode(next);
    setError("");
    const from = sourceMap();
    setName(uniqueMapName(next === "copy" && from ? `${from.name} (Copy)` : "Custom Map"));
  };
  const create = () => {
    const problem = mapNameProblem(name(), props.index) ?? (mode() === "blank" ? sizeProblem(width(), height()) : null);
    if (problem) {
      setError(problem);
      return;
    }
    const from = sourceMap();
    if (mode() === "copy" && !from) return;
    const map = mode() === "copy" && from ? copyFrom(from, name()) : newBlank(name(), width(), height());
    saveSlot(props.index, map);
    setEditingSlot(props.index);
  };
  return (() => {
    var _el$40 = _tmpl$162(), _el$41 = _el$40.firstChild, _el$42 = _el$41.nextSibling, _el$43 = _el$42.firstChild, _el$44 = _el$43.nextSibling, _el$47 = _el$42.nextSibling;
    insert(_el$41, createComponent(For, {
      each: ["blank", "copy"],
      children: (option) => (() => {
        var _el$48 = _tmpl$72();
        _el$48.$$click = () => {
          pickMode(option);
        };
        insert(_el$48, option === "blank" ? "Blank" : "Copy from");
        createRenderEffect(() => className(_el$48, `h-8 flex-1 cursor-pointer rounded-t-sm border-b-4 font-bold ${mode() === option ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF]" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53]"}`));
        return _el$48;
      })()
    }));
    insert(_el$40, createComponent(Show, {
      get when() {
        return mode() === "copy";
      },
      get children() {
        return createComponent(Dropdown, {
          get options() {
            return sources().map((s) => s.label);
          },
          get value() {
            return source();
          },
          onChange: (value) => {
            setSource(value);
            const from = sourceMap();
            if (from) setName(uniqueMapName(`${from.name} (Copy)`));
          }
        });
      }
    }), _el$42);
    _el$44.$$input = (e) => setName(e.currentTarget.value);
    insert(_el$40, createComponent(Show, {
      get when() {
        return mode() === "blank";
      },
      get children() {
        var _el$45 = _tmpl$142();
        insert(_el$45, createComponent(NumberInput, {
          label: "Width",
          get value() {
            return width();
          },
          onInput: setWidth
        }), null);
        insert(_el$45, createComponent(NumberInput, {
          label: "Height",
          get value() {
            return height();
          },
          onInput: setHeight
        }), null);
        return _el$45;
      }
    }), _el$47);
    insert(_el$40, createComponent(Show, {
      get when() {
        return error();
      },
      get children() {
        var _el$46 = _tmpl$152();
        insert(_el$46, error);
        return _el$46;
      }
    }), _el$47);
    insert(_el$47, createComponent(SmallButton, {
      get onClick() {
        return props.onCancel;
      },
      children: "Cancel"
    }), null);
    insert(_el$47, createComponent(SmallButton, {
      color: "light",
      onClick: create,
      children: "Create"
    }), null);
    createRenderEffect(() => _el$44.value = name());
    return _el$40;
  })();
}
function EditorSidebar() {
  const slot = () => editingSlot() ?? 0;
  const info = createMemo(() => {
    revision();
    return {
      name: mapGrid.name,
      width: mapGrid.width,
      height: mapGrid.height,
      spawns: spawnCount(mapGrid),
      numbered: mapGrid.priority.length
    };
  });
  const [name, setName] = createSignal("");
  const [nameError, setNameError] = createSignal("");
  const [width, setWidth] = createSignal(0);
  const [height, setHeight] = createSignal(0);
  const [anchor, setAnchor] = createSignal({
    x: 1,
    y: 1
  });
  const [sizeError, setSizeError] = createSignal("");
  const [showExport, setShowExport] = createSignal(false);
  const [importText, setImportText] = createSignal("");
  const [importError, setImportError] = createSignal("");
  const [pendingImport, setPendingImport] = createSignal(null);
  const [confirmImport, setConfirmImport] = createSignal(false);
  const [confirmClearPriority, setConfirmClearPriority] = createSignal(false);
  const exported = createMemo(() => {
    revision();
    return exportJson();
  });
  createEffect(on(() => [editingSlot(), info().name, info().width, info().height], () => {
    setName(info().name);
    setWidth(info().width);
    setHeight(info().height);
  }));
  const rename = () => {
    if (name().trim() === mapGrid.name) return;
    const problem = mapNameProblem(name(), slot());
    setNameError(problem ?? "");
    if (problem) return;
    mapGrid.name = name().trim();
    commit();
  };
  const resize = () => {
    const problem = sizeProblem(width(), height());
    setSizeError(problem ?? "");
    if (problem) return;
    resizeMap(width(), height(), anchor());
    editorRender();
    commit();
  };
  const readImport = () => {
    try {
      const map = parseMapJson(importText());
      map.name = uniqueMapName(map.name, slots(), slot());
      setImportError("");
      setPendingImport(map);
      setConfirmImport(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setImportError(message);
      setStatus(`Import failed: ${message}`);
    }
  };
  const applyImport = () => {
    const map = pendingImport();
    if (!map) return;
    saveSlot(slot(), map);
    fillGrid(map);
    needsFit = true;
    editorRender();
    setRevision((r) => r + 1);
    setImportText("");
    setPendingImport(null);
    setStatus(`Imported "${map.name}"`);
  };
  return (() => {
    var _el$49 = _tmpl$202(), _el$50 = _el$49.firstChild, _el$51 = _el$50.firstChild, _el$52 = _el$51.firstChild, _el$53 = _el$52.firstChild, _el$54 = _el$53.nextSibling, _el$55 = _el$54.firstChild, _el$58 = _el$55.nextSibling, _el$56 = _el$58.nextSibling, _el$59 = _el$56.nextSibling, _el$57 = _el$59.nextSibling, _el$60 = _el$51.nextSibling, _el$61 = _el$60.nextSibling, _el$62 = _el$61.firstChild, _el$64 = _el$62.nextSibling, _el$63 = _el$64.nextSibling, _el$65 = _el$61.nextSibling, _el$66 = _el$65.firstChild, _el$67 = _el$66.nextSibling, _el$69 = _el$65.nextSibling, _el$70 = _el$69.firstChild, _el$71 = _el$70.nextSibling, _el$72 = _el$71.firstChild, _el$74 = _el$69.nextSibling, _el$76 = _el$74.nextSibling, _el$79 = _el$50.nextSibling;
    insert(_el$49, createComponent(ModalHeader, {
      title: "Map Editor"
    }), _el$50);
    insert(_el$53, () => info().name);
    insert(_el$54, () => slot() + 1, _el$58);
    insert(_el$54, () => info().width, _el$59);
    insert(_el$54, () => info().height, null);
    insert(_el$54, createComponent(Show, {
      get when() {
        return timelineSlot() === slot();
      },
      children: " \xB7 used by this timeline"
    }), null);
    insert(_el$51, createComponent(SmallButton, {
      color: "light",
      onClick: () => setEditingSlot(null),
      children: "Change slot"
    }), null);
    insert(_el$50, createComponent(SectionHeader, {
      children: "Tools"
    }), _el$60);
    insert(_el$60, createComponent(For, {
      each: TOOL_BUTTONS,
      children: ({
        tool: option,
        label,
        color,
        border
      }) => (() => {
        var _el$80 = _tmpl$218(), _el$81 = _el$80.firstChild;
        _el$80.$$click = () => setTool(option);
        setStyleProperty(_el$81, "background", color);
        setStyleProperty(_el$81, "border", `1px solid ${border}`);
        insert(_el$80, label, null);
        createRenderEffect(() => className(_el$80, `flex h-9 cursor-pointer items-center gap-2 rounded-sm border-l-4 px-2 font-bold whitespace-nowrap shadow-sm shadow-black/50 ${tool() === option ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF]" : "border-transparent bg-[#1C2A32] text-[#C9C8CE] hover:text-[#EFEFEF]"}`));
        return _el$80;
      })()
    }));
    insert(_el$50, createComponent(SectionHeader, {
      children: "Spawn priority"
    }), _el$61);
    insert(_el$61, () => info().numbered, _el$62);
    insert(_el$61, () => info().spawns, _el$64);
    insert(_el$50, createComponent(SmallButton, {
      color: "red",
      get disabled() {
        return info().numbered === 0;
      },
      onClick: () => setConfirmClearPriority(true),
      "class": "self-start",
      children: "Clear priorities"
    }), _el$65);
    insert(_el$50, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body") ?? document.body;
      },
      title: "Clear priorities",
      content: "Remove the number from every spawn?",
      isActive: confirmClearPriority,
      setActive: setConfirmClearPriority,
      onClick: () => {
        mapGrid.priority.length = 0;
        editorRender();
        commit();
      }
    }), _el$65);
    insert(_el$50, createComponent(SectionHeader, {
      children: "Map options"
    }), _el$65);
    _el$67.$$keydown = (e) => {
      if (e.key === "Enter") rename();
    };
    _el$67.addEventListener("change", rename);
    _el$67.$$input = (e) => setName(e.currentTarget.value);
    insert(_el$50, createComponent(Show, {
      get when() {
        return nameError();
      },
      get children() {
        var _el$68 = _tmpl$172();
        insert(_el$68, nameError);
        return _el$68;
      }
    }), _el$69);
    insert(_el$70, createComponent(NumberInput, {
      label: "Width",
      get value() {
        return width();
      },
      onInput: setWidth
    }), null);
    insert(_el$70, createComponent(NumberInput, {
      label: "Height",
      get value() {
        return height();
      },
      onInput: setHeight
    }), null);
    insert(_el$72, createComponent(For, {
      each: [0, 1, 2],
      children: (y) => createComponent(For, {
        each: [0, 1, 2],
        children: (x) => (() => {
          var _el$82 = _tmpl$72();
          _el$82.$$click = () => setAnchor({
            x,
            y
          });
          createRenderEffect((_p$) => {
            var _v$5 = `Anchor ${["top", "middle", "bottom"][y]} ${["left", "centre", "right"][x]}`, _v$6 = `h-5 w-5 cursor-pointer rounded-xs ${anchor().x === x && anchor().y === y ? "bg-[#F0AF16]" : "bg-[#1C2A32] hover:bg-[#52575a]"}`;
            _v$5 !== _p$.e && setAttribute(_el$82, "aria-label", _p$.e = _v$5);
            _v$6 !== _p$.t && className(_el$82, _p$.t = _v$6);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$82;
        })()
      })
    }));
    insert(_el$69, createComponent(SmallButton, {
      onClick: resize,
      get disabled() {
        return memo(() => width() === info().width)() && height() === info().height;
      },
      "class": "ml-auto",
      children: "Resize"
    }), null);
    insert(_el$50, createComponent(Show, {
      get when() {
        return sizeError();
      },
      get children() {
        var _el$73 = _tmpl$172();
        insert(_el$73, sizeError);
        return _el$73;
      }
    }), _el$74);
    insert(_el$74, createComponent(SmallButton, {
      onClick: () => setShowExport(!showExport()),
      get children() {
        return showExport() ? "Hide export" : "Export JSON";
      }
    }));
    insert(_el$50, createComponent(Show, {
      get when() {
        return showExport();
      },
      get children() {
        return [(() => {
          var _el$75 = _tmpl$182();
          _el$75.addEventListener("focus", (e) => {
            e.currentTarget.select();
          });
          setAttribute(_el$75, "spellcheck", false);
          createRenderEffect(() => _el$75.value = exported());
          return _el$75;
        })(), createComponent(SmallButton, {
          color: "light",
          onClick: () => {
            copyText(exported());
          },
          "class": "self-start",
          children: "Copy"
        })];
      }
    }), _el$76);
    _el$76.$$input = (e) => setImportText(e.currentTarget.value);
    setAttribute(_el$76, "spellcheck", false);
    insert(_el$50, createComponent(Show, {
      get when() {
        return importError();
      },
      get children() {
        var _el$77 = _tmpl$192(), _el$78 = _el$77.firstChild;
        insert(_el$77, importError, null);
        return _el$77;
      }
    }), null);
    insert(_el$50, createComponent(SmallButton, {
      onClick: readImport,
      get disabled() {
        return !importText().trim();
      },
      "class": "self-start",
      children: "Import into this slot"
    }), null);
    insert(_el$50, createComponent(ConfirmModal, {
      get mount() {
        return document.querySelector("#body") ?? document.body;
      },
      title: "Replace map",
      get content() {
        return `Replace "${info().name}" in slot ${slot() + 1} with "${pendingImport()?.name ?? ""}"?`;
      },
      isActive: confirmImport,
      setActive: setConfirmImport,
      onClick: applyImport
    }), null);
    insert(_el$79, status);
    createRenderEffect(() => _el$67.value = name());
    createRenderEffect(() => _el$76.value = importText());
    return _el$49;
  })();
}
delegateEvents(["pointerdown", "pointermove", "pointerup", "contextmenu", "click", "input", "keydown"]);

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

// src/components/icons/Fortification.tsx
var _tmpl$50 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 40 40"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-5,-5)><g transform=matrix(1.5,0,0,1.5,-22.25,-20.75)><circle cx=31.5 cy=30.5 r=6 style=fill:rgb(77,131,152)></circle></g><g transform=matrix(2.03293,-2.03293,2.32335,2.32335,-82.455,23.2575)><path d="M30,20L30,27L22,27L22,20L30,20ZM28.828,21.025C27.267,19.659 24.733,19.659 23.172,21.025C21.611,22.391 21.611,24.609 23.172,25.975C24.733,27.341 27.267,27.341 28.828,25.975C30.389,24.609 30.389,22.391 28.828,21.025Z"style=fill:rgb(201,200,204);fill-opacity:0.5></path></g><g transform=matrix(2.03846,0,0,2.03846,-39.2115,-37.1731)><path d="M26.186,34.242C25.439,33.183 25,31.893 25,30.5C25,29.009 25.503,27.635 26.348,26.538L25.348,24.871C25.257,24.721 25.281,24.529 25.405,24.405C25.529,24.281 25.721,24.257 25.871,24.348L27.538,25.348C28.635,24.503 30.009,24 31.5,24C32.991,24 34.365,24.503 35.462,25.348L37.129,24.348C37.279,24.257 37.471,24.281 37.595,24.405C37.719,24.529 37.743,24.721 37.652,24.871L36.652,26.538C37.497,27.635 38,29.009 38,30.5C38,31.893 37.561,33.183 36.814,34.242L37.652,35.638C37.743,35.789 37.719,35.981 37.595,36.105C37.471,36.228 37.279,36.252 37.129,36.162L35.806,35.368C34.659,36.383 33.151,37 31.5,37C29.849,37 28.341,36.383 27.194,35.368L25.871,36.162C25.721,36.252 25.529,36.228 25.405,36.105C25.281,35.981 25.257,35.789 25.348,35.638L26.186,34.242ZM31.5,24.858C28.386,24.858 25.858,27.386 25.858,30.5C25.858,33.614 28.386,36.142 31.5,36.142C34.614,36.142 37.142,33.614 37.142,30.5C37.142,27.386 34.614,24.858 31.5,24.858Z"style=fill:rgb(201,200,204)>`);
function Fortification() {
  return _tmpl$50();
}

// src/components/icons/Borrow.tsx
var _tmpl$51 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 20 20"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-80.75,-27)><g transform=matrix(0.954545,0,0,1.22222,3.72727,-8.44444)><path d="M82,42.909L82,40.552C82,39.144 83.464,38 85.268,38L89.732,38C91.536,38 93,39.144 93,40.552L93,42.909L82,42.909Z"style=fill:rgb(249,196,32)></path></g><g transform=matrix(0.933333,0,0,0.875,5.86667,3.75)><ellipse cx=87.25 cy=34 rx=3.75 ry=4 style=fill:rgb(249,196,32)></ellipse></g></g><g transform=matrix(1,0,0,1,-80.75,-27)><g transform=matrix(0.818182,0,0,1.04762,23.4091,-2.95238)><path d="M83.125,38.626C83.699,38.236 84.448,38 85.268,38L89.732,38C91.536,38 93,39.144 93,40.552L93,42.909L86.583,42.909L86.583,41.591C86.583,40.041 85.063,38.766 83.125,38.626Z"style=fill:rgb(249,196,32)></path></g><g transform=matrix(0.8,0,0,0.75,25.2429,7.5)><ellipse cx=87.25 cy=34 rx=3.75 ry=4 style=fill:rgb(249,196,32)>`);
function Borrow() {
  return _tmpl$51();
}

// gfl2-data/buffs.tsx
var _tmpl$57 = /* @__PURE__ */ template(`<span>Increases Hydro and Freeze damage rate by <span style=color:#f26c1c>30%</span>, and increases Hydro and Freeze critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$219 = /* @__PURE__ */ template(`<span>Increase damage dealt by Vanguard-class Dolls by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$313 = /* @__PURE__ */ template(`<span>Light Ammo ignores <span style=color:#f26c1c>50%</span> of target's defense.`);
var _tmpl$410 = /* @__PURE__ */ template(`<span>Increase damage dealt by <span style=color:#f26c1c>20%</span> while <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=b3b>Frost Barrier</span></span> is active on self.`);
var _tmpl$58 = /* @__PURE__ */ template(`<span>Considered a <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=bb>Shield</span></span>. When <span style=color:#3487e0>Frost Barrier</span> is destroyed, applies <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=b8>Frigid</span></span> for <span style=color:#f26c1c>1 turn</span> to the unit that destroyed it. Considered a Freeze buff, cannot be cleansed.`);
var _tmpl$64 = /* @__PURE__ */ template(`<span>Absorbs a certain amount of damage. Shields do not stack, but they can overlap. When the most recently-applied shield has a longer duration or takes more damage than the previous one(s), it replaces the previous one(s). Shields include <span style=color:#3487e0>Frost Barrier</span>, <span style=color:#3487e0>Capital Protection</span> and other effects.`);
var _tmpl$73 = /* @__PURE__ */ template(`<span>Unable to move and cannot be actively displaced. Considered a Freeze movement debuff.`);
var _tmpl$83 = /* @__PURE__ */ template(`<span>Damage dealt is increased by <span style=color:#f26c1c>20%</span> when distance to the enemy target is less than or equal to <span style=color:#f26c1c>6 tiles</span>.`);
var _tmpl$93 = /* @__PURE__ */ template(`<span>If an enemy is afflicted by Freeze debuffs, critical damage against them is increased by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$02 = /* @__PURE__ */ template(`<span>Increase damage dealt with Support Skills by <span style=color:#f26c1c>15%</span>.`);
var _tmpl$110 = /* @__PURE__ */ template(`<span>Increase damage dealt by Sentinel-class Dolls by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$103 = /* @__PURE__ */ template(`<span>Heavy Ammo ignores <span style=color:#f26c1c>50%</span> of the target's defense.`);
var _tmpl$113 = /* @__PURE__ */ template(`<span>Increase damage dealt by <span style=color:#f26c1c>20%</span> if not within <span style=color:#f26c1c>6 tiles</span> of an enemy.`);
var _tmpl$123 = /* @__PURE__ */ template(`<span>When dealing damage to an enemy target, if they are afflicted by a Hydro debuff, increases the critical damage dealt against them by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$133 = /* @__PURE__ */ template(`<span>Increase critical rate of Sentinel-class Dolls by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$143 = /* @__PURE__ */ template(`<span>Increases AoE Damage dealt by <span style=color:#f26c1c>12%</span>.`);
var _tmpl$153 = /* @__PURE__ */ template(`<span>When dealing damage to an enemy target, if they are afflicted by Corrosion debuff, increases critical damage against them by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$163 = /* @__PURE__ */ template(`<span>Medium Ammo ignores <span style=color:#f26c1c>50%</span> of target's defense.`);
var _tmpl$173 = /* @__PURE__ */ template(`<span>Stability damage dealt by Support Dolls is increased by <span style=color:#f26c1c>2</span>.`);
var _tmpl$183 = /* @__PURE__ */ template(`<span>Increase damage dealt by <span style=color:#f26c1c>20%</span> while <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=b2l>Heat Recovery</span></span> is active on self.`);
var _tmpl$193 = /* @__PURE__ */ template(`<span>Before being attacked, recovers own HP equal to <span style=color:#f26c1c>30%</span> of attack, recovers <span style=color:#f26c1c>2 points</span> of stability, and randomly cleanses <span style=color:#f26c1c>1</span> buff from the attacker. Triggers <span style=color:#f26c1c>once</span>. Considered a Burn buff.`);
var _tmpl$203 = /* @__PURE__ */ template(`<span>When this unit possesses a <span style=color:#8679e8>Corrosion</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$2110 = /* @__PURE__ */ template(`<span>Critical damage against targets with Burn debuffs is increased by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$222 = /* @__PURE__ */ template(`<span>Increases Electric and Burn damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$232 = /* @__PURE__ */ template(`<span>Vanguard class Dolls gain <span style=color:#f26c1c>25%</span> critical rate.`);
var _tmpl$242 = /* @__PURE__ */ template(`<span>Corrosion damage is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$252 = /* @__PURE__ */ template(`<span>If an enemy is afflicted by an Electric debuff, increases critical damage against them by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$262 = /* @__PURE__ */ template(`<span>Damage dealt by Interception skills is increased by <span style=color:#f26c1c>15%</span>.`);
var _tmpl$272 = /* @__PURE__ */ template(`<span>Increases Corrosion and Freeze damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$282 = /* @__PURE__ */ template(`<span>Damage dealt by counterattack skills is increased by <span style=color:#f26c1c>15%</span>.`);
var _tmpl$292 = /* @__PURE__ */ template(`<span>Increases Corrosion and Burn damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$302 = /* @__PURE__ */ template(`<span>Burn damage is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$314 = /* @__PURE__ */ template(`<span>Increases Physical and Burn damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$322 = /* @__PURE__ */ template(`<span>When this unit has a <span style=color:#e67129>Burn</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$332 = /* @__PURE__ */ template(`<span>When this unit has a <span style=color:#2caadb>Hydro</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$342 = /* @__PURE__ */ template(`<span>Increases Physical damage dealt by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$352 = /* @__PURE__ */ template(`<span>Increases targeted damage dealt by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$362 = /* @__PURE__ */ template(`<span>When dealing Physical damage to enemy units, critical damage is increased by <span style=color:#f26c1c>20%</span> and the attack deals an additional <span style=color:#f26c1c>5 points</span> of stability damage.`);
var _tmpl$372 = /* @__PURE__ */ template(`<span>Increase Hydro and Burn damage dealt by <span style=color:#f26c1c>30%</span>, and critical rate of Hydro and Burn damage dealt by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$382 = /* @__PURE__ */ template(`<span>Increases Freeze damage dealt by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$392 = /* @__PURE__ */ template(`<span>Hydro and Electric damage dealt is increased by <span style=color:#f26c1c>30%</span>, critical rate of Hydro and Electric damage is increased by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$402 = /* @__PURE__ */ template(`<span>When this unit has an <span style=color:#d4ae08>Electric</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$412 = /* @__PURE__ */ template(`<span>Sentinel-class Dolls' critical damage is increased by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$422 = /* @__PURE__ */ template(`<span>Increases Electric damage dealt by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$432 = /* @__PURE__ */ template(`<span>When this unit's HP is <span style=color:#f26c1c>greater than or equal to 100%</span>, attacks ignore <span style=color:#f26c1c>30%</span> of the target's defense.`);
var _tmpl$442 = /* @__PURE__ */ template(`<span>Damage dealt by allied summoned units is increased by <span style=color:#f26c1c>50%</span>.`);
var _tmpl$452 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>1</span> allied unit within <span style=color:#f26c1c>5 tiles</span>, damage dealt is increased by <span style=color:#f26c1c>6%</span>.`);
var _tmpl$462 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>1 instance</span> of fixed damage taken by an enemy, all damage dealt by allied units is permanently increased by <span style=color:#f26c1c>2%</span>. Maximum of 15 stacks.`);
var _tmpl$472 = /* @__PURE__ */ template(`<span>When the target has a shield, attacks ignore <span style=color:#f26c1c>30%</span> of the target's defense.`);
var _tmpl$482 = /* @__PURE__ */ template(`<span>Critical damage dealt to targets with <span style=color:#f26c1c>0</span> stability is increased by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$492 = /* @__PURE__ */ template(`<span>Hydro and Corrosion damage dealt is increased by <span style=color:#f26c1c>30%</span>, critical rate of Hydro and Corrosion damage is increased by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$502 = /* @__PURE__ */ template(`<span>Melee attacks ignore <span style=color:#f26c1c>50%</span> of the target's defense.`);
var _tmpl$512 = /* @__PURE__ */ template(`<span>When dealing AoE damage, stability damage is increased by <span style=color:#f26c1c>10 points</span>.`);
var _tmpl$522 = /* @__PURE__ */ template(`<span>When this unit has <span style=color:#f26c1c>4 or more</span> buffs, attacks ignore <span style=color:#f26c1c>25%</span> of the target's defense.`);
var _tmpl$532 = /* @__PURE__ */ template(`<span>Increases Electric and Corrosion damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$542 = /* @__PURE__ */ template(`<span>Increases Freeze and Electric damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$552 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>5 tiles</span> moved, damage dealt is permanently increased by <span style=color:#f26c1c>5%</span>. Maximum of <span style=color:#f26c1c>10 stacks</span>.`);
var _tmpl$562 = /* @__PURE__ */ template(`<span>Increases Freeze and Burn damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$572 = /* @__PURE__ */ template(`<span>When this unit has a <span style=color:#42cce0>Freeze</span> buff, damage dealt is increased by <span style=color:#f26c1c>20%</span>.`);
var _tmpl$582 = /* @__PURE__ */ template(`<span>When shielded, attacks ignore <span style=color:#f26c1c>20%</span> of the target's defense and critical damage is increased by <span style=color:#f26c1c>10%</span>.`);
var _tmpl$59 = /* @__PURE__ */ template(`<span>When performing a Support Attack, critical damage is increased by <span style=color:#f26c1c>3%</span> and the attack ignores <span style=color:#f26c1c>5%</span> of the target's defense, can stack up to <span style=color:#f26c1c>5 times</span>.`);
var _tmpl$60 = /* @__PURE__ */ template(`<span>If this unit's has <span style=color:#f26c1c>2 or more</span> points of Confectance Index at the start of the round, damage dealt is increased by <span style=color:#f26c1c>25%</span> until the end of the round.`);
var _tmpl$61 = /* @__PURE__ */ template(`<span>Increases Physical and Freeze damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$622 = /* @__PURE__ */ template(`<span>Against targets with <span style=color:#f26c1c>2 or more</span> <span style=color:#f26c1c>Defense-type debuffs</span>, critical damage is increased by <span style=color:#f26c1c>25%</span>.`);
var _tmpl$632 = /* @__PURE__ */ template(`<span>Increases Physical and Corrosion damage by <span style=color:#f26c1c>30%</span>, and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$642 = /* @__PURE__ */ template(`<span><span style=color:#f26c1c>Each time</span> a Bulwark-class Doll takes damage, gains <span style=color:#f26c1c>1 stack</span> of <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=bil>Undaunted Spirit</span></span>.`);
var _tmpl$65 = /* @__PURE__ */ template(`<span>Damage dealt is increased by <span style=color:#f26c1c>5%</span>. At <span style=color:#f26c1c>20 stacks</span>, each stack additionally increases attack by <span style=color:#f26c1c>7%</span>. At <span style=color:#f26c1c>40 stacks</span>, each stack additionally increases critical damage by <span style=color:#f26c1c>10%</span>. This effect stacks up to <span style=color:#f26c1c>50 times</span>.`);
var _tmpl$66 = /* @__PURE__ */ template(`<span>For every <span style=color:#f26c1c>2000</span> points of <span style=color:#f26c1c>healing</span> or <span style=color:#f26c1c>shield</span> applied to allies by Support Dolls, gain <span style=color:#f26c1c>1 stack</span> of <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=bim>Complementarity Plan</span></span>.`);
var _tmpl$67 = /* @__PURE__ */ template(`<span>Damage dealt is increased by <span style=color:#f26c1c>2%</span>. At <span style=color:#f26c1c>20 stacks</span>, each additional attack further increases attack by <span style=color:#f26c1c>2%</span>. At <span style=color:#f26c1c>40 stacks</span>, each additional stack increases critical damage by <span style=color:#f26c1c>2%</span>. This effect stacks up to <span style=color:#f26c1c>50 times</span>.`);
var _tmpl$68 = /* @__PURE__ */ template(`<span>At the start of the turn, gains <span style=color:#f26c1c>10 stacks</span> of <span style=color:#3487e0><span class="font-bold underline text-[#4FA8E8] cursor-pointer hover:text-[#7DC0F5]"data-effect-id=bin>Firepower Overmatch</span></span>.`);
var _tmpl$69 = /* @__PURE__ */ template(`<span>Damage dealt is increased by <span style=color:#f26c1c>8%</span> and critical damage is increased by <span style=color:#f26c1c>5%</span> per stack, to a maximum of <span style=color:#f26c1c>50 stacks</span>. For <span style=color:#f26c1c>each point</span> of mobility spent, removes <span style=color:#f26c1c>1 stack</span> of this effect.`);
var _tmpl$70 = /* @__PURE__ */ template(`<span>Increases Physical and Hydro damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$71 = /* @__PURE__ */ template(`<span>Increases Physical and Electric damage and their critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$722 = /* @__PURE__ */ template(`<span>Increases phase damage of all attributes (excluding Physical attribute) by <span style=color:#f26c1c>30%</span> and increases its critical rate by <span style=color:#f26c1c>30%</span>.`);
var _tmpl$732 = /* @__PURE__ */ template(`<span>Hydro damage is increased by <span style=color:#f26c1c>20%</span>.`);
var tsxBuffs = {
  biv: _tmpl$57(),
  bja: _tmpl$219(),
  bjb: _tmpl$313(),
  bjc: _tmpl$410(),
  b3b: _tmpl$58(),
  bb: _tmpl$64(),
  b8: _tmpl$73(),
  bjd: _tmpl$83(),
  bje: _tmpl$93(),
  bjf: _tmpl$02(),
  bjg: _tmpl$110(),
  bjh: _tmpl$103(),
  bji: _tmpl$113(),
  bjj: _tmpl$123(),
  bjk: _tmpl$133(),
  bjl: _tmpl$143(),
  bjm: _tmpl$153(),
  bjn: _tmpl$163(),
  bjo: _tmpl$173(),
  bjp: _tmpl$183(),
  b2l: _tmpl$193(),
  bjq: _tmpl$203(),
  bjr: _tmpl$2110(),
  biw: _tmpl$222(),
  bjs: _tmpl$232(),
  bjt: _tmpl$242(),
  bju: _tmpl$252(),
  bjv: _tmpl$262(),
  bix: _tmpl$272(),
  bjw: _tmpl$282(),
  biy: _tmpl$292(),
  bjx: _tmpl$302(),
  biz: _tmpl$314(),
  bjy: _tmpl$322(),
  bjz: _tmpl$332(),
  bk0: _tmpl$342(),
  bk1: _tmpl$352(),
  bk2: _tmpl$362(),
  bj0: _tmpl$372(),
  bk3: _tmpl$382(),
  bj1: _tmpl$392(),
  bk4: _tmpl$402(),
  bk5: _tmpl$412(),
  bk6: _tmpl$422(),
  bk7: _tmpl$432(),
  bk8: _tmpl$442(),
  bk9: _tmpl$452(),
  bka: _tmpl$462(),
  bkb: _tmpl$472(),
  bkc: _tmpl$482(),
  bj2: _tmpl$492(),
  bkd: _tmpl$502(),
  bke: _tmpl$512(),
  bkf: _tmpl$522(),
  bj3: _tmpl$532(),
  bj4: _tmpl$542(),
  bkg: _tmpl$552(),
  bj5: _tmpl$562(),
  bkh: _tmpl$572(),
  bki: _tmpl$582(),
  bkj: _tmpl$59(),
  bkk: _tmpl$60(),
  bj6: _tmpl$61(),
  bkl: _tmpl$622(),
  bj7: _tmpl$632(),
  bkm: _tmpl$642(),
  bil: _tmpl$65(),
  bkn: _tmpl$66(),
  bim: _tmpl$67(),
  bko: _tmpl$68(),
  bin: _tmpl$69(),
  bj8: _tmpl$70(),
  bj9: _tmpl$71(),
  bmh: _tmpl$722(),
  bmn: _tmpl$732()
};
function Buffs(props) {
  if (props.id in tsxBuffs) {
    return tsxBuffs[props.id];
  }
  return null;
}

// src/components/SummaryView.tsx
var _tmpl$74 = /* @__PURE__ */ template(`<div class="flex flex-row gap-2"><div style="width:430px;height:430px;flex-shrink:0;overflow:hidden;border-right:1px solid #3f3f46"></div><div class="flex min-w-0 grow flex-col gap-1 overflow-y-auto">`);
var _tmpl$220 = /* @__PURE__ */ template(`<div class="flex flex-col items-start gap-1 rounded-xs border-b-2 bg-[#F4F4F6] p-1 shadow-sm shadow-black/30"><div class="flex flex-row items-center gap-1"><div class="font-bold text-[#325563]"></div></div><div class="min-w-0 flex-1"><div class="flex flex-wrap gap-1">`);
var _tmpl$315 = /* @__PURE__ */ template(`<span class="mr-1 inline-block h-3 w-3 align-[-1px] text-[#F0AF16]">`);
var _tmpl$411 = /* @__PURE__ */ template(`<span>`);
var _tmpl$510 = /* @__PURE__ */ template(`<div class="pt-1 text-sm text-zinc-600">No actions recorded`);
var _tmpl$610 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2">`);
var _tmpl$75 = /* @__PURE__ */ template(`<div class="flex h-full flex-col gap-3 overflow-auto bg-zinc-950 p-3"><div class="grid grid-cols-2 gap-2"></div><div class="flex flex-row flex-wrap gap-2 min-[1860px]:grid min-[1860px]:grid-cols-3">`);
var _tmpl$84 = /* @__PURE__ */ template(`<div class="relative h-6 w-6">`);
var _tmpl$94 = /* @__PURE__ */ template(`<div class="absolute bottom-1 left-2 z-10 h-8 w-8"><img class="relative h-full w-full object-cover">`);
var _tmpl$03 = /* @__PURE__ */ template(`<div class="flex flex-row items-center gap-2 rounded-sm border-t-4 border-[#3E5356] bg-[#2C373B] p-2 shadow-sm shadow-black/50"><div class="text-md flex w-12 flex-col items-center justify-center"><div class="relative h-12 w-12"><div class="absolute z-10"></div><div class="absolute z-20 flex h-full w-full items-center justify-center pt-0.5 text-[18px] font-bold"></div></div></div><div class="text-md relative flex h-12 w-12 flex-col items-center justify-start overflow-hidden rounded-full"><div class="h-8 w-8"><img></div><div class="absolute bottom-0 flex h-full w-full items-end justify-center bg-linear-to-t from-black/50 via-black/20 to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class></div></div></div><div class="relative flex h-17 w-32.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50"><div></div><img><div>`);
var _tmpl$111 = /* @__PURE__ */ template(`<div class="absolute right-1.5 bottom-1.5 z-20 rounded-sm bg-[#2A3D46] px-1 text-sm font-bold text-[#EFEFEF]">`);
var _tmpl$104 = /* @__PURE__ */ template(`<div class="inset-shadow-2xl relative flex h-17 w-17 flex-col items-center justify-center"><div class="absolute z-10"><div class="relative w-20"><img class="w-full object-cover object-top">`);
var _tmpl$114 = /* @__PURE__ */ template(`<div class="absolute right-0 bottom-0.5 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]"><div class="relative -top-1 -left-2.25 w-12"><img class="w-full object-cover object-top">`);
var _tmpl$124 = /* @__PURE__ */ template(`<div class="relative flex grow flex-row items-start gap-3 rounded-sm bg-[#F2EEF8] p-2.5 shadow-sm shadow-black/20"><div><img class="relative z-20 h-full w-full object-cover"></div><div class="flex grow flex-col gap-3 text-[#384B53]"><div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]"><div class="text-left font-bold text-black"></div><div class=text-left></div></div><div class=text-left>`);
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
  for (let x = 0; x < mapGrid.width; x++) {
    for (let y = 0; y < mapGrid.height; y++) {
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
    bMaxC = mapGrid.width - 1;
    bMinR = 0;
    bMaxR = mapGrid.height - 1;
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
  if (!ctx3) throw new Error("Could not get 2D canvas context");
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
  const labelW = Math.ceil(ctx3.measureText(`Turn ${tabIndex}`).width) + 6;
  ctx3.fillStyle = "rgba(0,0,0,0.65)";
  ctx3.fillRect(12, 17, labelW, 20);
  ctx3.fillStyle = "#2dd4bf";
  ctx3.fillText(`Turn ${tabIndex}`, 40, 20);
  return canvas;
}
function TabCard(props) {
  const mountCanvas = (canvasWrap) => {
    let frame = 0;
    createEffect(() => {
      trackStore(state);
      imagesLoaded();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        canvasWrap.replaceChildren(renderTabCanvas(props.tabIndex));
      });
    });
    onCleanup(() => {
      cancelAnimationFrame(frame);
    });
  };
  const actionOrder = createMemo(() => {
    const order = state.tabData[props.tabIndex]?.actionOrder ?? [];
    return getEntitiesByIdBatch(order.filter((_id, index) => isRenderable({
      kind: "actionOrder" /* ActionOrder */,
      tab: props.tabIndex,
      index
    })));
  });
  const hasActions = createMemo(() => {
    if (props.tabIndex === 0) return false;
    for (const sd of state.selectedDolls) {
      if (state.tabData[props.tabIndex].actions[sd.id]?.length) {
        return true;
      }
    }
    return false;
  });
  return createComponent(Modal, {
    width: "min-w-151 grow",
    get children() {
      var _el$ = _tmpl$74(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling;
      use(mountCanvas, _el$2);
      insert(_el$3, (() => {
        var _c$ = memo(() => !!hasActions());
        return () => _c$() ? createComponent(For, {
          get each() {
            return actionOrder();
          },
          children: (entity) => {
            const actions = createMemo(() => state.tabData[props.tabIndex]?.actions[entity.id] ?? []);
            if (!actions().length) return null;
            return (() => {
              var _el$4 = _tmpl$220(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild;
              insert(_el$5, createComponent(SquareDollChip, {
                target: entity,
                size: "h-10 w-10",
                icon: false,
                name: false
              }), _el$6);
              insert(_el$6, () => entity.name);
              insert(_el$8, createComponent(For, {
                get each() {
                  return actions();
                },
                children: (a, index) => {
                  const at = () => ({
                    tab: props.tabIndex,
                    ownerId: entity.id,
                    index: index()
                  });
                  const errors = createMemo(() => getActionErrors(at()));
                  return (() => {
                    var _el$9 = _tmpl$411();
                    insert(_el$9, createComponent(Show, {
                      get when() {
                        return errors().length;
                      },
                      get children() {
                        var _el$0 = _tmpl$315();
                        insert(_el$0, createComponent(Alert, {}));
                        return _el$0;
                      }
                    }), null);
                    insert(_el$9, () => renderAction(a, at()), null);
                    createRenderEffect((_p$) => {
                      var _v$ = `rounded-sm ${errors().length ? "bg-[#AE4749]" : "bg-[#384B53]"} px-1 py-0.5 text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50`, _v$2 = errors().map((e) => e.message).join("\n");
                      _v$ !== _p$.e && className(_el$9, _p$.e = _v$);
                      _v$2 !== _p$.t && setAttribute(_el$9, "title", _p$.t = _v$2);
                      return _p$;
                    }, {
                      e: void 0,
                      t: void 0
                    });
                    return _el$9;
                  })();
                }
              }));
              return _el$4;
            })();
          }
        }) : _tmpl$510();
      })());
      return _el$;
    }
  });
}
function SummaryView() {
  return (() => {
    var _el$10 = _tmpl$75(), _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling;
    insert(_el$11, createComponent(For, {
      get each() {
        return state.selectedDolls;
      },
      children: (selectedDoll3) => {
        const doll = getSelectedDoll(selectedDoll3);
        const dollFortification2 = createMemo(() => selectedDoll3.fortification || "\u2014");
        const dollRemolding = createMemo(() => `Lv.${selectedDoll3.remoldingLvl}`);
        const dollWeapon = createMemo(() => (
          // an unknown weapon (reported by validateSave) displays as the doll's signature weapon
          isRenderable({
            kind: "dollWeapon" /* DollWeapon */,
            dollId: doll.id
          }) ? getWeaponById(selectedDoll3.gun) : getWeaponByDollId(doll.id)
        ));
        const weaponChibi = createMemo(() => {
          return getDollChibiIconByWeapon(dollWeapon());
        });
        const dollKeys = createMemo(() => sortDisplayEquippedKeys(selectedDoll3));
        return (() => {
          var _el$14 = _tmpl$03(), _el$15 = _el$14.firstChild, _el$17 = _el$15.firstChild, _el$18 = _el$17.firstChild, _el$19 = _el$18.nextSibling, _el$20 = _el$15.nextSibling, _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild, _el$23 = _el$21.nextSibling, _el$24 = _el$23.firstChild, _el$25 = _el$20.nextSibling, _el$28 = _el$25.firstChild, _el$29 = _el$28.nextSibling, _el$30 = _el$29.nextSibling;
          insert(_el$14, createComponent(SmallDollChip, {
            target: doll
          }), _el$15);
          insert(_el$15, createComponent(Show, {
            get when() {
              return selectedDoll3.borrow;
            },
            get children() {
              var _el$16 = _tmpl$84();
              insert(_el$16, createComponent(Borrow, {}));
              return _el$16;
            }
          }), _el$17);
          insert(_el$18, createComponent(Fortification, {}));
          insert(_el$19, dollFortification2);
          insert(_el$24, dollRemolding);
          insert(_el$25, createComponent(Show, {
            get when() {
              return dollWeapon().dollId;
            },
            get children() {
              var _el$26 = _tmpl$94(), _el$27 = _el$26.firstChild;
              createRenderEffect(() => setAttribute(_el$27, "src", weaponChibi()));
              return _el$26;
            }
          }), _el$28);
          insert(_el$28, () => dollWeapon().name);
          insert(_el$25, createComponent(Show, {
            get when() {
              return dollWeapon().unreleased;
            },
            get children() {
              return createComponent(UnreleasedBadge, {
                "class": "top-1 left-1 z-30 text-xs"
              });
            }
          }), _el$30);
          insert(_el$14, createComponent(For, {
            get each() {
              return dollKeys();
            },
            children: (key) => {
              if (key) {
                const keyDollIcon = getDollAvatarByKey(key);
                return (() => {
                  var _el$31 = _tmpl$104(), _el$32 = _el$31.firstChild, _el$33 = _el$32.firstChild, _el$34 = _el$33.firstChild;
                  insert(_el$31, createComponent(Show, {
                    get when() {
                      return key.unreleased;
                    },
                    get children() {
                      return createComponent(UnreleasedBadge, {});
                    }
                  }), null);
                  insert(_el$31, createComponent(Show, {
                    get when() {
                      return key.number !== null;
                    },
                    get children() {
                      var _el$35 = _tmpl$111();
                      insert(_el$35, () => key.number);
                      return _el$35;
                    }
                  }), null);
                  insert(_el$31, keyDollIcon && (() => {
                    var _el$36 = _tmpl$114(), _el$37 = _el$36.firstChild, _el$38 = _el$37.firstChild;
                    setAttribute(_el$38, "src", keyDollIcon);
                    return _el$36;
                  })(), null);
                  createRenderEffect(() => setAttribute(_el$34, "src", key.icon));
                  return _el$31;
                })();
              }
            }
          }), null);
          createRenderEffect((_p$) => {
            var _v$3 = doll.icons.remolding, _v$4 = `absolute bottom-1 z-30 w-full text-right font-bold ${weaponChibi() === "" ? "pl-1.25" : "pl-9"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`, _v$5 = dollWeapon().icon, _v$6 = `relative z-20 h-full w-full border-b-3 ${rarityBorderColor(dollWeapon().rarity)} object-cover`, _v$7 = `absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${rarityGradientColor(dollWeapon().rarity)} from-0% to-transparent to-75%`;
            _v$3 !== _p$.e && setAttribute(_el$22, "src", _p$.e = _v$3);
            _v$4 !== _p$.t && className(_el$28, _p$.t = _v$4);
            _v$5 !== _p$.a && setAttribute(_el$29, "src", _p$.a = _v$5);
            _v$6 !== _p$.o && className(_el$29, _p$.o = _v$6);
            _v$7 !== _p$.i && className(_el$30, _p$.i = _v$7);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0
          });
          return _el$14;
        })();
      }
    }));
    insert(_el$12, createComponent(Modal, {
      width: "min-w-151 grow",
      get children() {
        var _el$13 = _tmpl$610();
        insert(_el$13, createComponent(For, {
          get each() {
            return state.buffs.filter((buffId) => isRenderable({
              kind: "buff" /* Buff */,
              buffId
            }));
          },
          children: (buffId) => {
            const season = getCurrentSeason();
            const buff = getBuffById(buffId);
            const isCore = buffId === season.buffId;
            const days = () => {
              if (buffId === season.buffId) {
                return "Effective this season";
              }
              if (season.dailyBuffIds[buffId]) {
                return "Available on days " + season.dailyBuffIds[buffId].join(", ");
              }
              return "Unavailable this gunsmoke season";
            };
            return (() => {
              var _el$39 = _tmpl$124(), _el$40 = _el$39.firstChild, _el$41 = _el$40.firstChild, _el$42 = _el$40.nextSibling, _el$43 = _el$42.firstChild, _el$44 = _el$43.firstChild, _el$45 = _el$44.nextSibling, _el$46 = _el$43.nextSibling;
              className(_el$40, `relative flex h-15 w-15 shrink-0 ${isCore ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`);
              insert(_el$44, () => buff.name);
              insert(_el$45, days);
              insert(_el$46, createComponent(Buffs, {
                get id() {
                  return buff.id;
                }
              }));
              createRenderEffect(() => setAttribute(_el$41, "src", buff.icon));
              return _el$39;
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
    return _el$10;
  })();
}

// src/components/icons/All.tsx
var _tmpl$76 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=All><g transform=matrix(1.70115,-3.86259e-32,0,1.70115,-40.1313,-31.7244)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.70115,-3.86259e-32,0,1.70115,-40.1313,-72.7244)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.04166e-16,-1.70115,1.70115,1.04166e-16,-31.7244,120.131)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z></path></g><g transform=matrix(1.04166e-16,-1.70115,1.70115,1.04166e-16,-72.7244,120.131)><path d=M47.104,43.926L57.391,54.213L47.104,64.5L36.817,54.213L47.104,43.926Z>`);
function All(props) {
  return (() => {
    var _el$ = _tmpl$76(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$3.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild;
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
var _tmpl$77 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.58211,0,0,1.96189,-23.2842,-43.7583)><g id=Burn><path id=standalone1 d="M33.696,61.874C31.412,61.39 29.373,60.638 27.611,59.665C22.976,56.825 20,52.43 20,47.5C20,47.378 20.002,47.257 20.005,47.136L20,47.136C20.022,42.298 22.463,38.039 26.151,35.553L26.151,36.321L26.166,36.31L26.166,37.225C25.873,37.711 25.714,38.242 25.714,38.757C25.714,40.416 27.471,41.785 29.902,41.762C33.055,41.733 34.559,39.775 34.559,38.116C34.559,37.807 34.477,37.514 34.329,37.243L34.329,37.22C33.787,36.034 33.512,34.557 33.601,32.742C33.61,32.568 33.628,32.393 33.655,32.218L33.642,32.218C33.659,32.141 33.676,32.065 33.695,31.989C34.345,28.673 38.109,25.149 42.496,23.457C42.63,23.406 42.763,23.361 42.896,23.324C42.899,24.148 42.948,25.064 42.948,26.042C42.948,27.27 44.643,31.18 49.318,33.784C55.668,36.382 60,41.552 60,47.5C60,52.559 56.866,57.055 52.023,59.884C50.109,60.883 47.884,61.627 45.381,62.062C49.032,60.428 51.791,57.425 51.791,54.64C51.791,52.663 51.135,51.019 50.053,49.758L50.084,49.702L49.898,49.584C49.242,48.868 48.444,48.283 47.549,47.841C44.734,45.506 41.84,42.273 41.84,40.492C41.84,40.298 41.852,40.109 41.875,39.925C40.472,41.233 39.564,43.317 39.564,45.663C39.564,46.699 39.741,47.684 40.06,48.574C40.067,48.687 40.07,48.801 40.07,48.916C40.07,51.609 38.273,53.796 36.06,53.796C34.221,53.796 32.669,52.285 32.198,50.228C30.435,51.815 29.351,53.856 29.351,55.835C29.351,58.332 31.066,60.524 33.696,61.874Z">`);
function Burn(props) {
  return (() => {
    var _el$ = _tmpl$77(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(228,102,41)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Corrosion.tsx
var _tmpl$78 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.74713,0,0,1.74713,-30.3218,-30.7586)><g id=Corrosion><g id=standalone1><g transform=matrix(1.11111,0,0,1.25,-5.38889,-15.5)><ellipse cx=39.5 cy=58 rx=4.5 ry=4></ellipse></g><g transform=matrix(1.06667,0,0,1.23077,-4.13333,-11.2308)><ellipse cx=54.5 cy=46.5 rx=7.5 ry=6.5></ellipse></g><g transform=matrix(1.18182,0,0,1,-10.5455,1)><ellipse cx=52.5 cy=24.5 rx=5.5 ry=6.5></ellipse></g><g transform=matrix(0.884615,0,0,1.21053,4.34615,-7.68421)><ellipse cx=29 cy=36.5 rx=13 ry=9.5>`);
function Corrosion(props) {
  return (() => {
    var _el$ = _tmpl$78(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild;
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
var _tmpl$79 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.63441,0,0,1.63441,-27.828,-26.6022)><g id=Electric><path id=standalone1 d=M50,17.5L33,17.5L25,46L42,42L34,64L58,33L40,36L50,17.5Z>`);
function Electric(props) {
  return (() => {
    var _el$ = _tmpl$79(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(235,191,33)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Freeze.tsx
var _tmpl$80 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.58333,0,0,1.58333,-23.1721,-23.3333)><g id=Freeze><g id=standalone1><g transform=matrix(1,0,0,1.2,-2,-12.8)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(1,0,0,1.2,-2,-36.8)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(0.961538,0,0,1.13636,-0.865385,-6.02273)><ellipse cx=42.5 cy=40.5 rx=6.5 ry=5.5></ellipse></g><g transform=matrix(0.499153,0.866514,-1.03982,0.598984,85.5838,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(-0.499989,0.866032,-1.03924,-0.599987,127.511,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(-0.499153,0.866514,1.03982,0.598984,-5.78748,-34.7286)><path d=M42,44L47,54L42,64L37,54L42,44Z></path></g><g transform=matrix(0.499989,0.866032,1.03924,-0.599987,-47.7144,42.0259)><path d=M42,44L47,54L42,64L37,54L42,44Z>`);
function Freeze(props) {
  return (() => {
    var _el$ = _tmpl$80(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$1.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$11.nextSibling, _el$14 = _el$13.firstChild, _el$15 = _el$13.nextSibling, _el$16 = _el$15.firstChild;
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
var _tmpl$81 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.72817,0,0,1.72817,-29.223,-29.1504)><g id=Hydro><g id=standalone1><g transform=matrix(1,0,0,1,2,-1.5)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z"></path></g><g transform=matrix(-1,0,0,-1,78.1114,81.5649)><path d="M28.498,38.795C27.628,40.686 25.716,42 23.5,42C20.464,42 18,39.536 18,36.5C18,35.615 18.209,34.779 18.581,34.038C28.304,13.475 48.678,15.236 59.198,36.5C48.334,25.273 37.769,23.076 28.498,38.795Z">`);
function Hydro(props) {
  return (() => {
    var _el$ = _tmpl$81(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild;
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
var _tmpl$85 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(1.54461,0,0,1.54461,-22.3824,-21.7702)><g id=Omni><g id=standalone1><g transform=matrix(1.27442,0,0,1.099,-10.2998,-2.98897)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(-0.585385,1.02359,-0.954008,-0.545589,103.249,20.7405)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(0.517371,0.996336,0.97534,-0.506469,-9.83172,37.6917)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(1.13281,-1.73412e-17,1.49543e-17,-1.099,14.7335,84.989)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(-0.547687,0.991618,0.962018,0.531338,13.4075,-3.22855)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z></path></g><g transform=matrix(0.55516,1.00515,-0.962018,0.531338,56.4324,-22.5184)><path d=M42.608,31.837L21.421,31.837L25.336,24.558L38.794,24.558L42.608,31.837Z>`);
function Omni(props) {
  return (() => {
    var _el$ = _tmpl$85(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$7.nextSibling, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$1.nextSibling, _el$12 = _el$11.firstChild, _el$13 = _el$11.nextSibling, _el$14 = _el$13.firstChild;
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
var _tmpl$86 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 80 80"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g id=standalone transform=matrix(2.47396,0,0,2.05405,-56.4844,-37.027)><g id=Physical><path id=standalone1 d=M39,19L52.856,28.25L52.856,46.75L39,56L25.144,46.75L25.144,28.25L39,19ZM29.023,44.16L32.903,41.57L32.903,33.43L39,29.36L45.097,33.43L45.097,41.57L48.977,44.16L48.977,30.84L39,24.18L29.023,30.84L29.023,44.16Z>`);
function Physical(props) {
  return (() => {
    var _el$ = _tmpl$86(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild;
    createRenderEffect((_$p) => style(_el$4, `fill:${props.fill ?? "rgb(201,200,206)"};`, _$p));
    return _el$;
  })();
}

// src/components/icons/Phase.tsx
function Phase2(props) {
  switch (props.phase) {
    default:
      return createComponent(All, {
        get fill() {
          return props.fill;
        }
      });
    case 1 /* Physical */:
      return createComponent(Physical, {
        get fill() {
          return props.fill;
        }
      });
    case 2 /* Burn */:
      return createComponent(Burn, {
        get fill() {
          return props.fill;
        }
      });
    case 4 /* Electric */:
      return createComponent(Electric, {
        get fill() {
          return props.fill;
        }
      });
    case 5 /* Freeze */:
      return createComponent(Freeze, {
        get fill() {
          return props.fill;
        }
      });
    case 3 /* Corrosion */:
      return createComponent(Corrosion, {
        get fill() {
          return props.fill;
        }
      });
    case 6 /* Hydro */:
      return createComponent(Hydro, {
        get fill() {
          return props.fill;
        }
      });
    case 7 /* Resonance */:
      return createComponent(Omni, {
        get fill() {
          return props.fill;
        }
      });
  }
}

// src/components/DollChip.tsx
var _tmpl$87 = /* @__PURE__ */ template(`<span class="gf-badge gf-badge-inert pointer-events-auto absolute right-0.5 bottom-0.5 z-20"title="No skills: it can't move or act, it only occupies a tile">`);
var _tmpl$221 = /* @__PURE__ */ template(`<div><div><div class="absolute top-1 left-1 h-6 w-6"></div><img loading=lazy decoding=async width=128 height=128 class="h-auto w-32 object-cover"></div><div class="font-condensed bg-[#1C2A32] p-1 text-center font-bold text-[#EFEFEF]">`, true, false, false);
var _tmpl$316 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function DollChip(props) {
  const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
  const doll = getDollByDollOrSummon(props.target);
  const phaseClass = doll.phase === 7 /* Resonance */ ? [2 /* Burn */, 3 /* Corrosion */, 4 /* Electric */, 5 /* Freeze */, 6 /* Hydro */] : [doll.phase];
  const phase = phaseClass.map((p) => PhaseLabels[p]).join(" ");
  return (() => {
    var _el$ = _tmpl$221(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$6 = _el$2.nextSibling;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$7 = _tmpl$316();
        insert(_el$7, createComponent(Check, {}));
        return _el$7;
      })();
    })(), _el$3);
    insert(_el$3, createComponent(PhaseIcon, {
      get phase() {
        return doll.phase;
      }
    }));
    setAttribute(_el$4, "src", icon);
    insert(_el$2, createComponent(Show, {
      get when() {
        return isUnreleased(props.target);
      },
      get children() {
        return createComponent(UnreleasedBadge, {});
      }
    }), null);
    insert(_el$2, createComponent(Show, {
      get when() {
        return isInertSummon(props.target);
      },
      get children() {
        var _el$5 = _tmpl$87();
        insert(_el$5, createComponent(Immobile, {}));
        return _el$5;
      }
    }), null);
    insert(_el$6, () => props.target.name);
    createRenderEffect((_p$) => {
      var _v$ = props.style, _v$2 = `doll ${phase} All show ${props.pinned ? "pinned" : ""} h-40.5 w-31.5 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50 ${interactiveStyles(props.selected)}`, _v$3 = `relative flex justify-center border-b-4 bg-[#C9C8CD] ${rarityBorderColor(doll.rarity)}`;
      _p$.e = style(_el$, _v$, _p$.e);
      _v$2 !== _p$.t && className(_el$, _p$.t = _v$2);
      _v$3 !== _p$.a && className(_el$2, _p$.a = _v$3);
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

// src/store/scheduling.ts
function runAfterFramePaint(callback) {
  requestAnimationFrame(() => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = callback;
    messageChannel.port2.postMessage(void 0);
  });
}

// src/components/modals/DollSelectorModal.tsx
var _tmpl$88 = /* @__PURE__ */ template(`<div class="flex gap-1 px-3 pb-1.75">`);
var _tmpl$223 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="grid grid-cols-6 gap-4">`);
var _tmpl$317 = /* @__PURE__ */ template(`<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Changing dolls will clear their positions and actions`);
var _tmpl$413 = /* @__PURE__ */ template(`<button><div class="h-6 w-6"></div><span>`);
function DollSelectorModal() {
  const phaseTabs = [8 /* All */, 1 /* Physical */, 2 /* Burn */, 4 /* Electric */, 5 /* Freeze */, 3 /* Corrosion */, 6 /* Hydro */];
  const selectedDollIds = createMemo(() => tempSelectedDolls.map((doll) => doll.id));
  const [pinnedIds, setPinnedIds] = createSignal([]);
  const snapshotPinned = () => setPinnedIds(tempSelectedDolls.map((doll) => doll.id));
  onMount(snapshotPinned);
  const dollOrder = (doll) => {
    const i = pinnedIds().indexOf(doll.id);
    return i !== -1 ? i : pinnedIds().length + visibleDollIndex(doll);
  };
  const toggleDoll = (id) => {
    if (selectedDollIds().includes(id)) {
      removeDollFromTempSelect(id);
    } else if (selectedDollIds().length < MAX_TEAM_SIZE) {
      addDollToTempSelect(id);
    }
  };
  const toggleDollVisibility = (phase) => {
    runAfterFramePaint(() => {
      document.querySelectorAll(`.doll`).forEach((el) => {
        el.classList.remove("show");
      });
      runAfterFramePaint(() => {
        document.querySelectorAll(`.doll.${PhaseLabels[phase]}, .doll.pinned`).forEach((el) => {
          el.classList.remove("hide");
          el.classList.add("show");
        });
        runAfterFramePaint(() => {
          document.querySelectorAll(`.doll:not(.${PhaseLabels[phase]}):not(.pinned)`).forEach((el) => {
            el.classList.add("hide");
          });
        });
      });
    });
  };
  return [createComponent(ModalHeader, {
    title: "Select Dolls"
  }), (() => {
    var _el$ = _tmpl$88();
    insert(_el$, createComponent(For, {
      each: phaseTabs,
      children: (tab) => (() => {
        var _el$5 = _tmpl$413(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
        _el$5.$$click = () => {
          snapshotPinned();
          setActivePhaseTab(tab);
          toggleDollVisibility(tab);
        };
        insert(_el$6, createComponent(Phase2, {
          phase: tab,
          get fill() {
            return activePhaseTab() === tab ? "#EFEFEF" : "#384B53";
          }
        }));
        insert(_el$7, () => PhaseLabels[tab]);
        createRenderEffect(() => className(_el$5, `flex h-13 flex-1 items-center justify-center gap-1 rounded-t-sm border-b-4 px-1 pt-3 pb-2 text-2xl font-bold transition-all ${activePhaseTab() === tab ? "border-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "border-[#8F9094] bg-[#A8A9AE] text-[#384B53] hover:border-[#606164]"}`));
        return _el$5;
      })()
    }));
    return _el$;
  })(), (() => {
    var _el$2 = _tmpl$223(), _el$3 = _el$2.firstChild;
    insert(_el$3, createComponent(For, {
      get each() {
        return Object.values(combinedDolls.data);
      },
      children: (doll) => {
        const isSel = () => selectedDollIds().includes(doll.id);
        return createComponent(DollChip, {
          target: doll,
          get selected() {
            return isSel();
          },
          get pinned() {
            return pinnedIds().includes(doll.id);
          },
          onClick: () => {
            toggleDoll(doll.id);
          },
          get style() {
            return `--animation-order: ${dollOrder(doll)};order:${dollOrder(doll)}`;
          }
        });
      }
    }));
    return _el$2;
  })(), _tmpl$317(), createComponent(ModalFooter, {
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
var _tmpl$89 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><textarea class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-4 font-mono text-xs"placeholder="Paste here..."></textarea><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Imported state will overwrite current local timeline`);
function ImportModal() {
  const [text, setText] = createSignal("");
  const performImport = async () => {
    setLoaded(false);
    setStateFromURL(false);
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    await importState(loadFromString, text());
    setShowImportModal(false);
    setLoaded(true);
  };
  return [createComponent(ModalHeader, {
    title: "Import Transcript"
  }), (() => {
    var _el$ = _tmpl$89(), _el$2 = _el$.firstChild;
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
        onClick: () => void performImport(),
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["input"]);

// src/components/modals/TargetModal.tsx
var _tmpl$90 = /* @__PURE__ */ template(`<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"><div class="overflow-hidden rounded-sm border-t-[6px] border-[#506A6C] bg-[#293438]"><div class="border-b border-zinc-700 p-6 text-center"><h3 class="text-lg font-bold"></h3><p class="text-xs text-zinc-400"> \u2192 Target</p></div><div class="grid grid-cols-3 justify-items-center gap-4 p-5"></div><div class="flex justify-center gap-4 border-t border-zinc-700 p-6">`);
function TargetModal() {
  const retarget = retargetAction();
  onCleanup(() => setRetargetAction(null));
  const skillInfo = createMemo(() => {
    const skillId = targetSkillId();
    if (skillId) {
      return getSkillById(skillId);
    }
    return null;
  });
  const targets = createMemo(() => getSelectedDollAndSummonInfo([targetDollId()], true, retarget?.tab ?? localState.currentTab));
  const recordSkill2 = (dollId, entry) => {
    setState(produce((s) => {
      const tab = s.tabData[localState.currentTab];
      if (!tab.actions[dollId]) tab.actions[dollId] = [];
      tab.actions[dollId].push(entry);
    }));
    saveToLocalStorage();
  };
  const replaceTarget = (target) => {
    if (!retarget) return;
    setState(produce((s) => {
      const action = s.tabData[retarget.tab]?.actions[retarget.ownerId]?.[retarget.index];
      if (action?.[0] === targetSkillId()) action[1] = target.id;
    }));
    saveToLocalStorage();
  };
  const handleSelect = (target) => {
    const dollId = targetDollId();
    const skillId = targetSkillId();
    if (!dollId || skillId == null) return;
    if (retarget) replaceTarget(target);
    else recordSkill2(dollId, [skillId, target.id]);
    setShowTargetModal(false);
  };
  return (() => {
    var _el$ = _tmpl$90(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$3.nextSibling, _el$8 = _el$7.nextSibling;
    insert(_el$4, retarget ? "Select New Target" : "Select Target Character");
    insert(_el$5, () => skillInfo()?.name, _el$6);
    insert(_el$5, () => retarget ? ` (${retarget.tab === 0 ? "setup" : `turn ${retarget.tab}`})` : "", null);
    insert(_el$7, createComponent(For, {
      get each() {
        return targets();
      },
      children: (doll) => createComponent(DollChip, {
        onClick: () => {
          handleSelect(doll);
        },
        target: doll,
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

// src/components/icons/Bolt.tsx
var _tmpl$91 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 24 24"xmlns=http://www.w3.org/2000/svg aria-hidden=true><path d="M13.5 2L4 13.5h6.5L9.5 22 20 9.5h-6.5L13.5 2z"style=fill:currentColor>`);
function Bolt() {
  return _tmpl$91();
}

// src/store/saveFixes.ts
var MAX_FIX_STEPS = 500;
function fullSlotsEquip(fix) {
  if (fix.kind !== "equipKey" /* EquipKey */ || !isKnownKeyId(fix.keyId)) return void 0;
  const sd = selectedDoll2(fix.dollId);
  if (!sd || sd.keys.includes(fix.keyId)) return void 0;
  return freeKeySlots(sd, getKeyById(fix.keyId).type) > 0 ? void 0 : { dollId: fix.dollId, keyId: fix.keyId };
}
function keySwapImpact(team, dollId, outKey, inKey) {
  const preview = (dolls) => {
    const timeline = structuredClone(unwrap(state));
    applySelectedDolls(timeline, dolls);
    return timeline;
  };
  const copy = () => structuredClone(team.map((sd2) => unwrap(sd2)));
  const before = preview(copy());
  const swapped = copy();
  const sd = swapped.find((d) => d.id === dollId);
  if (sd) {
    const index = sd.keys.indexOf(outKey);
    if (index === -1) sd.keys.push(inKey);
    else sd.keys[index] = inKey;
  }
  const after = preview(swapped);
  const known = new Set(uniqueMessages(validateSave(before)));
  const impact = new Set(uniqueMessages(validateSave(after)).filter((message) => !known.has(message)));
  if (outKey !== "") for (const loss of lostToKey(before, after, outKey)) impact.add(loss);
  return [...impact];
}
var ownerBase = (id) => hasPrefix(id, "m" /* Summons */) ? summonBaseIdOf(id) : id;
function lostToKey(before, after, outKey) {
  const lost = /* @__PURE__ */ new Set();
  for (const [tabIndex, tab] of before.tabData.entries()) {
    const afterTab = after.tabData[tabIndex];
    const afterActions = new Map(
      Object.entries(afterTab.actions).map(([id, actions]) => [ownerBase(id), actions])
    );
    for (const [ownerKey, actions] of Object.entries(tab.actions)) {
      const ownerId = ownerKey;
      const now = afterActions.get(ownerBase(ownerId));
      if (!actions.length) continue;
      if (!now?.length) {
        if (hasPrefix(ownerId, "m" /* Summons */))
          lost.add(`${entityName(ownerId)} and all its placements and actions are removed from the timeline`);
        continue;
      }
      for (const [index, [skillId]] of actions.entries()) {
        const newId = now[index]?.[0];
        if (newId === void 0 || newId === skillId || !isKnownSkillId(skillId) || !isKnownSkillId(newId)) continue;
        if (getSkillTier(skillId).keyId !== outKey) continue;
        lost.add(`${entityName(ownerId)}'s "${getSkillRequirement(skillId).name}" loses the bonus from ${keyName(outKey)}`);
      }
    }
    const placedAfter = new Set(afterTab.summonPositions.map((p) => summonBaseIdOf(p.id)));
    for (const p of tab.summonPositions) {
      if (!placedAfter.has(summonBaseIdOf(p.id)))
        lost.add(`${entityName(p.id)} and all its placements and actions are removed from the timeline`);
    }
  }
  return [...lost];
}
function selectedDoll2(dollId) {
  return state.selectedDolls.find((sd) => sd.id === dollId);
}
function freeKeySlots(sd, type) {
  const doll = getSelectedDoll(sd);
  const slots2 = KEY_SLOTS.filter((slot) => slot === type && (slot !== 3 /* ExpansionKey */ || hasExpansionKey(doll))).length;
  const used = new Set(sd.keys.filter((keyId) => keyId !== "" && isKnownKeyId(keyId) && getKeyById(keyId).type === type));
  return slots2 - used.size;
}
function turnName(tab) {
  return tab === 0 ? "setup" : `turn ${tab}`;
}
function copiedPlacements(fix) {
  const from = state.tabData[fix.fromTab];
  if (!from) return [];
  if (hasPrefix(fix.id, "d" /* Dolls */)) {
    const position = from.dollPositions[fix.id];
    return position && position.x > -1 && position.y > -1 ? [{ x: position.x, y: position.y }] : [];
  }
  const base = summonBaseIdOf(fix.id);
  return from.summonPositions.filter((p) => summonBaseIdOf(p.id) === base).map((p) => ({ x: p.x, y: p.y, mapId: p.mapId }));
}
function occupantOf(tabIndex, x, y, id) {
  const tab = state.tabData[tabIndex];
  for (const [dollId, position] of Object.entries(tab.dollPositions)) {
    if (dollId !== id && position.x === x && position.y === y) return entityName(dollId);
  }
  const summon = tab.summonPositions.find((p) => p.x === x && p.y === y);
  return summon ? entityName(summon.id) : void 0;
}
var NOTHING_TO_REMOVE = /* @__PURE__ */ new Set(["timeline" /* Timeline */, "map" /* Map */, "doll" /* Doll */, "dollWeapon" /* DollWeapon */]);
function canApplyFix(fix) {
  switch (fix.kind) {
    case "equipKey" /* EquipKey */: {
      const sd = selectedDoll2(fix.dollId);
      if (!sd || sd.keys.includes(fix.keyId) || !isKnownKeyId(fix.keyId)) return false;
      return freeKeySlots(sd, getKeyById(fix.keyId).type) > 0;
    }
    case "selectDoll" /* SelectDoll */:
      return !selectedDoll2(fix.dollId) && state.selectedDolls.length < MAX_TEAM_SIZE;
    case "removeEntry" /* RemoveEntry */:
      return !NOTHING_TO_REMOVE.has(fix.location.kind);
    case "setMap" /* SetMap */:
    case "replaceId" /* ReplaceId */:
    case "keepOnTile" /* KeepOnTile */:
      return true;
    case "chooseTarget" /* ChooseTarget */:
      return getTargetCandidates(fix.location.ownerId, fix.location.tab).length > 0;
    case "copyPosition" /* CopyPosition */: {
      const placements = copiedPlacements(fix);
      return placements.length > 0 && placements.every((p) => occupantOf(fix.tab, p.x, p.y, fix.id) === void 0);
    }
    case "placeAt" /* PlaceAt */:
      return occupantOf(fix.tab, fix.x, fix.y, fix.id) === void 0;
    default:
      return selectedDoll2(fix.dollId) !== void 0;
  }
}
var MANUAL_FIX_REASON = "Please manually fix this issue";
function cantApplyReason(fix) {
  if (fix.kind === "equipKey" /* EquipKey */ && isKnownKeyId(fix.keyId)) {
    return `${getDollById(fix.dollId).name} has no free ${KeyTypeLabels[getKeyById(fix.keyId).type]} slot; unequip one first`;
  }
  if (fix.kind === "selectDoll" /* SelectDoll */) return `The team already has ${MAX_TEAM_SIZE} dolls`;
  if (fix.kind === "chooseTarget" /* ChooseTarget */) {
    return `No other ally is on the map ${fix.location.tab === 0 ? "in setup" : `on turn ${fix.location.tab}`}`;
  }
  if (fix.kind === "copyPosition" /* CopyPosition */) {
    const name = entityName(fix.id);
    for (const p of copiedPlacements(fix)) {
      const occupant = occupantOf(fix.tab, p.x, p.y, fix.id);
      if (occupant) return `${occupant} is on ${name}'s tile from ${turnName(fix.fromTab)}; move them first`;
    }
    return `${name} is no longer on the map ${describeTurns([fix.fromTab])}`;
  }
  if (fix.kind === "placeAt" /* PlaceAt */) {
    return `${occupantOf(fix.tab, fix.x, fix.y, fix.id) ?? "Someone"} is already on that tile`;
  }
  return MANUAL_FIX_REASON;
}
function dollName2(id) {
  return getDollById(id).name;
}
function loadoutOwner(id) {
  const owner = hasPrefix(id, "m" /* Summons */) ? id : getSkillRequirement(id).ownerId;
  return hasPrefix(owner, "m" /* Summons */) ? getSummonOwnerId(owner) : owner;
}
function describeFix(fix) {
  switch (fix.kind) {
    case "equipKey" /* EquipKey */:
      return `Equip ${keyName(fix.keyId)} on ${dollName2(fix.dollId)}`;
    case "unequipKey" /* UnequipKey */:
      return `Unequip ${isKnownKeyId(fix.keyId) ? keyName(fix.keyId) : `unknown key "${String(fix.keyId)}"`}`;
    case "setFortification" /* SetFortification */:
      return `Set ${dollName2(fix.dollId)} to V${fix.fortification}`;
    case "replaceId" /* ReplaceId */: {
      const known = hasPrefix(fix.to, "m" /* Summons */) ? isKnownSummonId(fix.to) : isKnownSkillId(fix.to);
      return known ? `Update to match ${dollName2(loadoutOwner(fix.to))}'s current loadout` : "Update to match the current loadout";
    }
    case "setWeapon" /* SetWeapon */:
      return isKnownWeaponId(fix.weaponId) ? `Use signature weapon "${getWeaponById(fix.weaponId).name}"` : "Use signature weapon";
    case "setRemolding" /* SetRemolding */:
      return `Set remolding to ${fix.level}`;
    case "setBorrow" /* SetBorrow */:
      if (!fix.borrow) return `Set ${dollName2(fix.dollId)} as not borrowed`;
      return state.selectedDolls.some((sd) => sd.borrow) ? `Keep ${dollName2(fix.dollId)} as the borrowed doll` : `Set ${dollName2(fix.dollId)} as the borrowed doll`;
    case "selectDoll" /* SelectDoll */:
      return `Add ${dollName2(fix.dollId)} to the team`;
    case "setMap" /* SetMap */:
      return `Change map to ${fix.map}`;
    case "removeEntry" /* RemoveEntry */:
      return describeRemoval([fix.location]);
    case "chooseTarget" /* ChooseTarget */:
      return "Choose a new target";
    case "copyPosition" /* CopyPosition */:
      return `Copy ${entityName(fix.id)}'s position from ${turnName(fix.fromTab)}`;
    case "placeAt" /* PlaceAt */:
      if (fix.near) return `Place ${entityName(fix.id)} on the free tile nearest ${dollName2(fix.near)}`;
      return `Place ${entityName(fix.id)} on an open spawn tile`;
    case "keepOnTile" /* KeepOnTile */:
      return `Keep ${positionName(fix.keep)} on the tile`;
  }
}
function positionName(location2) {
  if (location2.kind === "dollPosition" /* DollPosition */) return entityName(location2.dollId);
  const position = state.tabData[location2.tab]?.summonPositions[location2.index];
  return position ? entityName(position.id) : "the summon";
}
function removalTarget(location2) {
  switch (location2.kind) {
    case "action" /* Action */:
      return "this skill use";
    case "actionTarget" /* ActionTarget */:
      return "this skill's target";
    case "actionList" /* ActionList */:
      return `${entityName(location2.ownerId)}'s actions`;
    case "actionOrder" /* ActionOrder */: {
      const id = state.tabData[location2.tab]?.actionOrder[location2.index];
      return id ? `${entityName(id)} from the action order` : "the action order entry";
    }
    case "summonPosition" /* SummonPosition */: {
      const position = state.tabData[location2.tab]?.summonPositions[location2.index];
      return position ? `${entityName(position.id)} from the map` : "the summon from the map";
    }
    case "dollPosition" /* DollPosition */:
      return `${entityName(location2.dollId)} from the map`;
    case "buff" /* Buff */:
      return "the buff";
    case "dollKey" /* DollKey */:
      return isKnownKeyId(location2.keyId) ? keyName(location2.keyId) : "the key";
    case "timeline" /* Timeline */:
    case "map" /* Map */:
    case "doll" /* Doll */:
    case "dollWeapon" /* DollWeapon */:
      return "the entry";
  }
}
var PLURAL_TARGETS = {
  "this skill use": "skill uses",
  "this skill's target": "skill targets"
};
function describeTurns(tabs) {
  const turns = tabs.filter((tab) => tab > 0);
  const parts = tabs.includes(0) ? ["in setup"] : [];
  if (turns.length) parts.push(`on ${turns.length === 1 ? "turn" : "turns"} ${listText(turns.map(String))}`);
  return listText(parts);
}
function listText(items) {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] ?? "";
}
function describeRemoval(locations) {
  const counts = /* @__PURE__ */ new Map();
  for (const location2 of locations) {
    const target = removalTarget(location2);
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const targets = [...counts].map(
    ([target, count]) => count > 1 && PLURAL_TARGETS[target] ? `${count} ${PLURAL_TARGETS[target]}` : target
  );
  const tabs = [...new Set(locations.flatMap((location2) => "tab" in location2 ? [location2.tab] : []))].sort((a, b) => a - b);
  return `Remove ${listText(targets)}${tabs.length ? ` ${describeTurns(tabs)}` : ""}`;
}
function groupRemovalLocations(group) {
  return group.errors.flatMap((error) => error.fixes.filter((fix) => fix.kind === "removeEntry" /* RemoveEntry */).map((fix) => fix.location));
}
function editLoadout(dollId, edit) {
  const team = state.selectedDolls.map((sd2) => ({ ...sd2, keys: [...sd2.keys] }));
  const sd = team.find((d) => d.id === dollId);
  if (!sd || !edit(sd, team)) return false;
  changeSelectedDolls(team);
  return true;
}
function equipKey(sd, keyId) {
  if (sd.keys.includes(keyId)) return false;
  const type = getKeyById(keyId).type;
  let index = sd.keys.findIndex((slot, i) => slot === "" && KEY_SLOTS[i] === type);
  if (index === -1) index = sd.keys.findIndex((slot) => slot === "");
  if (index === -1) {
    if (sd.keys.length >= KEY_SLOTS.length) return false;
    index = sd.keys.length;
  }
  sd.keys[index] = keyId;
  return true;
}
function unequipKey(sd, keyId) {
  const index = sd.keys.lastIndexOf(keyId);
  if (index === -1) return false;
  sd.keys[index] = "";
  return true;
}
function editTab(tabIndex, edit) {
  let changed = false;
  setState(
    produce((s) => {
      const tab = s.tabData[tabIndex];
      if (tab) changed = edit(tab);
    })
  );
  return changed;
}
function replaceId(location2, from, to) {
  if (!("tab" in location2)) return false;
  return editTab(location2.tab, (tab) => {
    switch (location2.kind) {
      case "action" /* Action */: {
        const action = tab.actions[location2.ownerId]?.[location2.index];
        if (action?.[0] !== from) return false;
        action[0] = to;
        return true;
      }
      case "actionTarget" /* ActionTarget */: {
        const action = tab.actions[location2.ownerId]?.[location2.index];
        if (action?.[1] !== from) return false;
        action[1] = to;
        return true;
      }
      case "summonPosition" /* SummonPosition */: {
        const position = tab.summonPositions[location2.index];
        if (position?.id !== from) return false;
        position.id = to;
        return true;
      }
      case "actionOrder" /* ActionOrder */:
        if (tab.actionOrder[location2.index] !== from) return false;
        tab.actionOrder[location2.index] = to;
        return true;
      case "actionList" /* ActionList */: {
        const actions = tab.actions[from];
        if (!actions?.length) return false;
        tab.actions[to] = [...tab.actions[to] ?? [], ...actions];
        delete tab.actions[from];
        return true;
      }
      default:
        return false;
    }
  });
}
function removeEntry(location2) {
  switch (location2.kind) {
    case "buff" /* Buff */: {
      if (!state.buffs.includes(location2.buffId)) return false;
      setState("buffs", (buffs) => buffs.filter((buffId) => buffId !== location2.buffId));
      return true;
    }
    case "dollKey" /* DollKey */:
      return editLoadout(location2.dollId, (sd) => unequipKey(sd, location2.keyId));
    case "timeline" /* Timeline */:
    case "map" /* Map */:
    case "doll" /* Doll */:
    case "dollWeapon" /* DollWeapon */:
      return false;
  }
  return editTab(location2.tab, (tab) => {
    switch (location2.kind) {
      case "action" /* Action */: {
        const actions = tab.actions[location2.ownerId];
        if (!actions || location2.index >= actions.length) return false;
        actions.splice(location2.index, 1);
        return true;
      }
      case "actionTarget" /* ActionTarget */: {
        const action = tab.actions[location2.ownerId]?.[location2.index];
        if (action?.[1] === void 0) return false;
        tab.actions[location2.ownerId][location2.index] = [action[0]];
        return true;
      }
      case "actionList" /* ActionList */: {
        if (!tab.actions[location2.ownerId]?.length) return false;
        tab.actions[location2.ownerId] = [];
        return true;
      }
      case "actionOrder" /* ActionOrder */: {
        if (location2.index >= tab.actionOrder.length) return false;
        tab.actionOrder.splice(location2.index, 1);
        return true;
      }
      case "summonPosition" /* SummonPosition */: {
        if (location2.index >= tab.summonPositions.length) return false;
        tab.summonPositions.splice(location2.index, 1);
        return true;
      }
      case "dollPosition" /* DollPosition */: {
        const position = tab.dollPositions[location2.dollId];
        if (!position || position.x === -1 && position.y === -1) return false;
        tab.dollPositions[location2.dollId] = { x: -1, y: -1 };
        return true;
      }
    }
  });
}
function applySaveFix(fix) {
  switch (fix.kind) {
    case "equipKey" /* EquipKey */:
      return isKnownKeyId(fix.keyId) && editLoadout(fix.dollId, (sd) => equipKey(sd, fix.keyId));
    case "unequipKey" /* UnequipKey */:
      return editLoadout(fix.dollId, (sd) => unequipKey(sd, fix.keyId));
    case "setFortification" /* SetFortification */:
      return editLoadout(fix.dollId, (sd) => {
        if (sd.fortification === fix.fortification) return false;
        sd.fortification = fix.fortification;
        return true;
      });
    case "setWeapon" /* SetWeapon */:
      return editLoadout(fix.dollId, (sd) => {
        if (sd.gun === fix.weaponId) return false;
        sd.gun = fix.weaponId;
        return true;
      });
    case "setRemolding" /* SetRemolding */:
      return editLoadout(fix.dollId, (sd) => {
        if (sd.remoldingLvl === fix.level) return false;
        sd.remoldingLvl = fix.level;
        return true;
      });
    case "setBorrow" /* SetBorrow */:
      return editLoadout(fix.dollId, (sd, team) => {
        const others = fix.borrow ? team.filter((other) => other !== sd && other.borrow) : [];
        if (sd.borrow === fix.borrow && !others.length) return false;
        for (const other of others) other.borrow = false;
        sd.borrow = fix.borrow;
        return true;
      });
    case "selectDoll" /* SelectDoll */: {
      if (!canApplyFix(fix)) return false;
      changeSelectedDolls([...state.selectedDolls.map((sd) => ({ ...sd, keys: [...sd.keys] })), defaultLoadout(fix.dollId)]);
      return true;
    }
    case "replaceId" /* ReplaceId */:
      return replaceId(fix.location, fix.from, fix.to);
    case "removeEntry" /* RemoveEntry */:
      return removeEntry(fix.location);
    case "setMap" /* SetMap */:
      if (state.map === fix.map) return false;
      setState("map", fix.map);
      loadMap(fix.map);
      return true;
    case "chooseTarget" /* ChooseTarget */:
      return false;
    case "copyPosition" /* CopyPosition */: {
      if (!canApplyFix(fix)) return false;
      const id = fix.id;
      const placements = copiedPlacements(fix);
      if (hasPrefix(id, "d" /* Dolls */)) {
        return editTab(fix.tab, (tab) => {
          tab.dollPositions[id] = { x: placements[0].x, y: placements[0].y };
          return true;
        });
      }
      const fresh = [];
      const positions = placements.map((p) => {
        const mapId = p.mapId !== void 0 && p.mapId !== "" ? p.mapId : nextSummonInstanceId(state.tabData, fresh);
        fresh.push(mapId);
        return { id, mapId, x: p.x, y: p.y };
      });
      return editTab(fix.tab, (tab) => {
        tab.summonPositions.push(...positions);
        return true;
      });
    }
    case "placeAt" /* PlaceAt */: {
      if (!canApplyFix(fix)) return false;
      const id = fix.id;
      if (hasPrefix(id, "d" /* Dolls */)) {
        return editTab(fix.tab, (tab) => {
          tab.dollPositions[id] = { x: fix.x, y: fix.y };
          return true;
        });
      }
      const mapId = earlierInstanceId(id, fix.tab) ?? nextSummonInstanceId(state.tabData);
      return editTab(fix.tab, (tab) => {
        tab.summonPositions.push({ id, mapId, x: fix.x, y: fix.y });
        return true;
      });
    }
    case "keepOnTile" /* KeepOnTile */: {
      const { keep } = fix;
      const onTile = (p) => p.x === fix.x && p.y === fix.y;
      return editTab(fix.tab, (tab) => {
        let changed = false;
        for (const [key, position] of Object.entries(tab.dollPositions)) {
          const dollId = key;
          if (!onTile(position) || keep.kind === "dollPosition" /* DollPosition */ && keep.dollId === dollId) continue;
          tab.dollPositions[dollId] = { x: -1, y: -1 };
          changed = true;
        }
        const kept = tab.summonPositions.filter(
          (p, index) => !onTile(p) || keep.kind === "summonPosition" /* SummonPosition */ && keep.index === index
        );
        if (kept.length !== tab.summonPositions.length) {
          tab.summonPositions = kept;
          changed = true;
        }
        return changed;
      });
    }
  }
}
function earlierInstanceId(id, tab) {
  const base = summonBaseIdOf(id);
  for (let fromTab = tab - 1; fromTab >= 0; fromTab--) {
    const placement = state.tabData[fromTab].summonPositions.find((p) => summonBaseIdOf(p.id) === base && p.mapId);
    if (placement) return placement.mapId;
  }
  return void 0;
}
function openTargetPicker(location2) {
  const action = state.tabData[location2.tab]?.actions[location2.ownerId]?.[location2.index];
  if (!action) return;
  setTargetDollId(location2.ownerId);
  setTargetSkillId(action[0]);
  setRetargetAction({ tab: location2.tab, ownerId: location2.ownerId, index: location2.index });
  setShowTargetModal(true);
}
async function finishFixes() {
  setupTempSelectedDolls();
  for (let i = 0; i < 8; i++) defaultActionOrder(i);
  await preloadCanvasImages();
  saveToLocalStorage();
}
var isLoadoutRequirement = (fix) => fix.kind === "equipKey" /* EquipKey */ || fix.kind === "setFortification" /* SetFortification */;
function autoFixesFor(error) {
  const requirements = error.fixes.filter(isLoadoutRequirement);
  if (requirements.length && requirements.every(canApplyFix)) return requirements;
  const fix = error.fixes.find((f) => !isLoadoutRequirement(f) && isAutoFix(f) && canApplyFix(f));
  return fix ? [fix] : null;
}
function groupAutoFixes(group) {
  const fixes = /* @__PURE__ */ new Map();
  for (const error of group.errors) {
    for (const fix of autoFixesFor(error) ?? []) fixes.set(fixKey(fix), fix);
  }
  return [...fixes.values()];
}
function runFixes(pick) {
  const stuck = /* @__PURE__ */ new Set();
  let applied = 0;
  for (let step = 0; step < MAX_FIX_STEPS; step++) {
    let batch2 = null;
    let batchKey = "";
    for (const error of validateSave(state)) {
      const fixes = pick(error);
      if (!fixes) continue;
      const key = JSON.stringify(fixes);
      if (stuck.has(key)) continue;
      batch2 = fixes;
      batchKey = key;
      break;
    }
    if (!batch2) break;
    let changed = 0;
    for (const fix of batch2) if (applySaveFix(fix)) changed++;
    if (!changed) stuck.add(batchKey);
    applied += changed;
  }
  return applied;
}
async function fixAll() {
  const applied = runFixes(autoFixesFor);
  if (applied) await finishFixes();
  return applied;
}
function sameFix(a, b) {
  return fixKey(a) === fixKey(b);
}
async function applyToGroup(message, fix) {
  const applied = runFixes((error) => {
    if (error.message !== message) return null;
    const match = error.fixes.find((f) => sameFix(f, fix) && canApplyFix(f));
    return match ? [match] : null;
  });
  if (applied) await finishFixes();
  return applied;
}

// src/components/modals/IssuesModal.tsx
var _tmpl$95 = /* @__PURE__ */ template(`<span class="h-3 w-3 shrink-0">`);
var _tmpl$224 = /* @__PURE__ */ template(`<span class="flex min-w-0 items-center rounded-r-sm bg-[#C9C8CE] px-1.5 py-0.5 text-xs text-[#384B53]">`);
var _tmpl$318 = /* @__PURE__ */ template(`<div class="flex max-w-full items-stretch rounded-sm shadow-sm shadow-black/30"><button>`);
var _tmpl$414 = /* @__PURE__ */ template(`<button title="Applies every fix marked with this icon"><span class="h-3.5 w-3.5 shrink-0"></span>Fix <!> automatically`);
var _tmpl$511 = /* @__PURE__ */ template(`<div class="flex items-center justify-between gap-2"><h3 class=font-bold>: Might be leftovers from changing dolls or equipment.`);
var _tmpl$611 = /* @__PURE__ */ template(`<div class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-sm bg-[#E4E3E7] px-2 pb-2 text-sm">`);
var _tmpl$710 = /* @__PURE__ */ template(`<p class="text-sm font-bold">`);
var _tmpl$810 = /* @__PURE__ */ template(`<div class="mx-3 flex flex-col gap-3 text-[#384B53]">`);
var _tmpl$96 = /* @__PURE__ */ template(`<p class="rounded-sm bg-[#E4E3E7] p-3 text-center font-bold text-[#3D7A4A]">No issues detected in this timeline.`);
var _tmpl$04 = /* @__PURE__ */ template(`<section class="flex flex-col gap-1.5"><h4 class="sticky top-0 z-10 -mx-2 flex items-center justify-between bg-[#384B53] px-2 py-1 font-bold text-[#EFEFEF]"><span></span><span class="text-xs font-normal"></span></h4><ul class="flex flex-col gap-1.5">`);
var _tmpl$115 = /* @__PURE__ */ template(`<span class="text-xs text-[#606164] italic">Cannot be automatically fixed`);
var _tmpl$105 = /* @__PURE__ */ template(`<li class="flex items-center gap-2 border-b border-[#C2C0C4] pb-1.5 last:border-b-0 last:pb-0"><div class="flex min-w-0 grow flex-col gap-1"><span></span><div class="flex flex-wrap items-center gap-1">`);
var _tmpl$116 = /* @__PURE__ */ template(`<img class="h-8 w-8 shrink-0 rounded-full bg-[#C9C8CE] object-cover object-top">`);
var _tmpl$125 = /* @__PURE__ */ template(`<button title="Opens the doll's keys with the slot to change highlighted; confirm the equipment screen to apply">Open <!>'s equipment`);
function plural(count, word, many = word + "s") {
  return `${count} ${count === 1 ? word : many}`;
}
var AUTO_COLOR = "bg-[#3D7A4A]";
function FixButton(props) {
  const applicable = () => canApplyFix(props.fix);
  const removes = () => props.fix.kind === "removeEntry" /* RemoveEntry */;
  const label = () => removes() ? describeRemoval(groupRemovalLocations(props.group)) : describeFix(props.fix);
  const blockedReason = () => {
    if (applicable()) return void 0;
    const reason = cantApplyReason(props.fix);
    return reason === MANUAL_FIX_REASON ? void 0 : reason;
  };
  const title = () => !applicable() ? blockedReason() ? void 0 : cantApplyReason(props.fix) : props.auto ? "Applied by Fix automatically" : void 0;
  return (
    // one chip with its reason, so it wraps along with the other buttons rather than leaving a gap beside or under it
    (() => {
      var _el$ = _tmpl$318(), _el$2 = _el$.firstChild;
      addEventListener(_el$2, "click", props.onClick, true);
      insert(_el$2, createComponent(Show, {
        get when() {
          return props.auto;
        },
        get children() {
          var _el$3 = _tmpl$95();
          insert(_el$3, createComponent(Bolt, {}));
          return _el$3;
        }
      }), null);
      insert(_el$2, label, null);
      insert(_el$, createComponent(Show, {
        get when() {
          return blockedReason();
        },
        get children() {
          var _el$4 = _tmpl$224();
          insert(_el$4, blockedReason);
          return _el$4;
        }
      }), null);
      createRenderEffect((_p$) => {
        var _v$ = props.disabled || !applicable(), _v$2 = title(), _v$3 = `flex items-center gap-1 px-2 py-0.5 text-left text-xs font-bold text-[#EFEFEF] ${blockedReason() ? "rounded-l-sm" : "rounded-sm"} ${props.auto ? AUTO_COLOR : removes() ? "bg-[#944040]" : "bg-[#1C2A32]"} ${props.disabled || !applicable() ? "cursor-default opacity-50" : "cursor-pointer outline-2 outline-transparent hover:outline-white"}`;
        _v$ !== _p$.e && (_el$2.disabled = _p$.e = _v$);
        _v$2 !== _p$.t && setAttribute(_el$2, "title", _p$.t = _v$2);
        _v$3 !== _p$.a && className(_el$2, _p$.a = _v$3);
        return _p$;
      }, {
        e: void 0,
        t: void 0,
        a: void 0
      });
      return _el$;
    })()
  );
}
function IssuesModal() {
  const [fixing, setFixing] = createSignal(false);
  const [fixResult, setFixResult] = createSignal("");
  const groups = saveIssueGroups;
  const autoFixable = () => groups().filter((group) => groupAutoFixes(group).length > 0).length;
  const runFixAll = async () => {
    const before = groups().length;
    setFixing(true);
    try {
      const applied = await fixAll();
      const fixed = before - groups().length;
      setFixResult(fixed > 0 ? `Fixed ${plural(fixed, "problem")}` : applied ? `Applied ${plural(applied, "fix", "fixes")}` : "Nothing could be fixed automatically");
    } finally {
      setFixing(false);
    }
  };
  const runGroupFix = async (group, fix) => {
    setFixResult("");
    if (fix.kind === "chooseTarget" /* ChooseTarget */) {
      const choose = group.errors.flatMap((error) => error.fixes).find((f) => f.kind === "chooseTarget" /* ChooseTarget */ && canApplyFix(f));
      if (choose?.kind === "chooseTarget" /* ChooseTarget */) openTargetPicker(choose.location);
      return;
    }
    setFixing(true);
    try {
      await applyToGroup(group.message, fix);
    } finally {
      setFixing(false);
    }
  };
  return [createComponent(ModalHeader, {
    title: "Fix Issues"
  }), (() => {
    var _el$5 = _tmpl$810();
    insert(_el$5, createComponent(Show, {
      get when() {
        return groups().length;
      },
      get fallback() {
        return _tmpl$96();
      },
      get children() {
        return [(() => {
          var _el$6 = _tmpl$511(), _el$7 = _el$6.firstChild, _el$8 = _el$7.firstChild;
          insert(_el$7, () => plural(groups().length, "issue"), _el$8);
          insert(_el$6, createComponent(Show, {
            get when() {
              return autoFixable();
            },
            get children() {
              var _el$9 = _tmpl$414(), _el$0 = _el$9.firstChild, _el$1 = _el$0.nextSibling, _el$11 = _el$1.nextSibling, _el$10 = _el$11.nextSibling;
              _el$9.$$click = () => void runFixAll();
              insert(_el$0, createComponent(Bolt, {}));
              insert(_el$9, autoFixable, _el$11);
              createRenderEffect((_p$) => {
                var _v$4 = fixing(), _v$5 = `flex shrink-0 items-center gap-1.5 rounded-sm ${AUTO_COLOR} px-3 py-1 text-sm font-bold text-[#EFEFEF] shadow-sm shadow-black/50 ${fixing() ? "cursor-default opacity-50" : "cursor-pointer outline-2 outline-transparent hover:outline-white"}`;
                _v$4 !== _p$.e && (_el$9.disabled = _p$.e = _v$4);
                _v$5 !== _p$.t && className(_el$9, _p$.t = _v$5);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$9;
            }
          }), null);
          return _el$6;
        })(), (() => {
          var _el$12 = _tmpl$611();
          insert(_el$12, createComponent(For, {
            get each() {
              return saveIssueSections();
            },
            children: (section) => (() => {
              var _el$15 = _tmpl$04(), _el$16 = _el$15.firstChild, _el$17 = _el$16.firstChild, _el$18 = _el$17.nextSibling, _el$19 = _el$16.nextSibling;
              insert(_el$17, () => section.title);
              insert(_el$18, () => plural(section.groups.length, "problem"));
              insert(_el$19, createComponent(For, {
                get each() {
                  return section.groups;
                },
                children: (group) => {
                  const autoKeys = () => new Set(groupAutoFixes(group).map(fixKey));
                  const isAuto = (fix) => autoKeys().has(fixKey(fix));
                  const fixes = () => {
                    const all = [...group.autoFixes, ...group.manualFixes];
                    return [...all.filter(isAuto), ...all.filter((fix) => !isAuto(fix))];
                  };
                  return (() => {
                    var _el$20 = _tmpl$105(), _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild, _el$23 = _el$22.nextSibling;
                    insert(_el$20, createComponent(Show, {
                      get when() {
                        return issueSubject(group);
                      },
                      children: (subject) => (() => {
                        var _el$25 = _tmpl$116();
                        createRenderEffect((_p$) => {
                          var _v$6 = subject().icon, _v$7 = subject().name, _v$8 = subject().name;
                          _v$6 !== _p$.e && setAttribute(_el$25, "src", _p$.e = _v$6);
                          _v$7 !== _p$.t && setAttribute(_el$25, "alt", _p$.t = _v$7);
                          _v$8 !== _p$.a && setAttribute(_el$25, "title", _p$.a = _v$8);
                          return _p$;
                        }, {
                          e: void 0,
                          t: void 0,
                          a: void 0
                        });
                        return _el$25;
                      })()
                    }), _el$21);
                    insert(_el$22, () => group.reason);
                    insert(_el$23, createComponent(For, {
                      get each() {
                        return fixes();
                      },
                      children: (fix) => [createComponent(FixButton, {
                        fix,
                        group,
                        get auto() {
                          return isAuto(fix);
                        },
                        get disabled() {
                          return fixing();
                        },
                        onClick: () => void runGroupFix(group, fix)
                      }), createComponent(Show, {
                        get when() {
                          return fullSlotsEquip(fix);
                        },
                        children: (equip) => (() => {
                          var _el$26 = _tmpl$125(), _el$27 = _el$26.firstChild, _el$29 = _el$27.nextSibling, _el$28 = _el$29.nextSibling;
                          _el$26.$$click = () => {
                            openDollKeys(equip().dollId, {
                              keyId: equip().keyId,
                              reason: group.reason
                            });
                          };
                          insert(_el$26, () => getDollById(equip().dollId).name, _el$29);
                          createRenderEffect((_p$) => {
                            var _v$9 = fixing(), _v$0 = `rounded-sm bg-[#384B53] px-2 py-0.5 text-left text-xs font-bold text-[#EFEFEF] shadow-sm shadow-black/30 ${fixing() ? "cursor-default opacity-50" : "cursor-pointer outline-2 outline-transparent hover:outline-white"}`;
                            _v$9 !== _p$.e && (_el$26.disabled = _p$.e = _v$9);
                            _v$0 !== _p$.t && className(_el$26, _p$.t = _v$0);
                            return _p$;
                          }, {
                            e: void 0,
                            t: void 0
                          });
                          return _el$26;
                        })()
                      })]
                    }), null);
                    insert(_el$23, createComponent(Show, {
                      get when() {
                        return !fixes().some((fix) => canApplyFix(fix) || fullSlotsEquip(fix));
                      },
                      get children() {
                        return _tmpl$115();
                      }
                    }), null);
                    return _el$20;
                  })();
                }
              }));
              return _el$15;
            })()
          }));
          return _el$12;
        })()];
      }
    }), null);
    insert(_el$5, createComponent(Show, {
      get when() {
        return fixResult();
      },
      get children() {
        var _el$13 = _tmpl$710();
        insert(_el$13, fixResult);
        return _el$13;
      }
    }), null);
    return _el$5;
  })(), createComponent(ModalFooter, {
    styles: "justify-center",
    get children() {
      return createComponent(Button, {
        onClick: () => setShowIssuesModal(false),
        color: "dark",
        design: "cancel",
        content: "Close"
      });
    }
  })];
}
delegateEvents(["click"]);

// src/components/modals/ExportModal.tsx
var _tmpl$97 = /* @__PURE__ */ template(`<span tabindex=0 class="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full bg-[#384B53] text-[10px] font-bold text-[#EFEFEF]">?`);
var _tmpl$225 = /* @__PURE__ */ template(`<button role=tab><span class="text-2xl font-bold"></span><span class="text-sm leading-tight">`);
var _tmpl$319 = /* @__PURE__ */ template(`<span class="text-xs text-[#606164]"> (<!>)`);
var _tmpl$415 = /* @__PURE__ */ template(`<li class="flex items-center gap-2"><span class="w-4 shrink-0 text-center font-bold text-[#AE4749]">\u2717</span><span>`);
var _tmpl$513 = /* @__PURE__ */ template(`<section class="flex items-center justify-between gap-3 rounded-sm bg-[#E4E3E7] p-2"><h3 class="text-sm font-bold">`);
var _tmpl$612 = /* @__PURE__ */ template(`<span class="rounded-sm bg-[#AE4749] p-1.5 font-bold text-[#EFEFEF]">`);
var _tmpl$711 = /* @__PURE__ */ template(`<div class="flex flex-col gap-1 text-xs"><span>/2000 characters`);
var _tmpl$811 = /* @__PURE__ */ template(`<label><input type=checkbox>`);
var _tmpl$98 = /* @__PURE__ */ template(`<section class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm"><span class=font-bold>Include:</span><div class="flex flex-row flex-wrap gap-4"></div><span class=font-bold>Format:</span><div class="flex flex-row flex-wrap gap-4">`);
var _tmpl$05 = /* @__PURE__ */ template(`<div role=tablist class="flex gap-2 px-3 pb-2">`);
var _tmpl$117 = /* @__PURE__ */ template(`<div class="mx-3 flex flex-col gap-3 text-[#384B53]"><textarea readonly class="h-40 resize-none self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs break-all text-[#EFEFEF]">`);
var _tmpl$106 = /* @__PURE__ */ template(`<h3 class=font-bold>Before sharing`);
var _tmpl$118 = /* @__PURE__ */ template(`<ul class="flex flex-col gap-1 text-sm">`);
var _tmpl$126 = /* @__PURE__ */ template(`<div class="flex items-center justify-center self-stretch bg-[#AE4749] p-2 text-center font-bold tracking-wide text-[#ECECEC]">`);
var _tmpl$134 = /* @__PURE__ */ template(`<textarea readonly class="h-16 resize-none self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs break-all text-[#EFEFEF]">`);
var _tmpl$144 = /* @__PURE__ */ template(`<div class="mx-3 flex flex-col gap-3 text-[#384B53]"><section class="flex flex-col gap-1.5"><label class="flex flex-row items-center gap-2 text-sm">Score:<input class=input type=number min=1 placeholder=Required></label><div class="flex items-center gap-2 text-sm">Description:</div><textarea maxlength=128 class="input h-16 resize-none self-stretch overflow-hidden rounded-md p-2 text-xs"placeholder="Optional notes about the timeline..."></textarea><span class="self-end text-xs text-[#606164]">/128`);
var MAX_DESCRIPTION_LENGTH = 128;
var HELP = {
  score: "Providing an accurate score allows for timelines to be sorted by score with those selected dolls at that investment.",
  description: "Description is optional to include extra notes about the timeline if needed.",
  fixedKeys: "3 Fixed Keys are required for shared timelines so consumers have a minimum build to copy."
};
function formatExportText(code, options) {
  const body = options.discord ? "```" + code + "```" : code;
  return options.header ? `${options.header}
${body}` : body;
}
function formatLinkText(url, options) {
  if (options.discord) return `[${options.header ? `Timeline: ${options.header}` : "Gunsmoke timeline"}](${url})`;
  return options.header ? `${options.header}
${url}` : url;
}
var TEXT_LIMIT = 2e3;
var INCLUDE_WEIGHT = {
  boss: 4,
  dolls: 2,
  season: 1
};
function headerParts() {
  const parts = [];
  const seasonNumber = getCurrentSeason().season;
  if (localState.exportIncludeSeason && seasonNumber !== void 0 && seasonNumber > 0) {
    parts.push({
      key: "season",
      text: `Season ${seasonNumber}`
    });
  }
  if (localState.exportIncludeBoss && isBuiltInMap(state.map)) parts.push({
    key: "boss",
    text: state.map
  });
  if (localState.exportIncludeDolls) parts.push({
    key: "dolls",
    text: getSelectedDollNamesAndFortifications().join(", ")
  });
  return parts;
}
function fitText(parts, discord, build) {
  const subsets = Array.from({
    length: 1 << parts.length
  }, (_, mask) => parts.filter((_part, i) => mask & 1 << i));
  const weight = (subset) => subset.reduce((sum, part) => sum + INCLUDE_WEIGHT[part.key], 0);
  subsets.sort((a, b) => b.length - a.length || weight(b) - weight(a));
  const droppedFrom = (kept) => parts.filter((part) => !kept.includes(part)).map((part) => part.key);
  for (const kept of subsets) {
    const text = build({
      header: kept.map((part) => part.text).join(" | "),
      discord
    });
    if (text.length <= TEXT_LIMIT) return {
      text,
      dropped: droppedFrom(kept),
      plain: false,
      tooLong: false
    };
  }
  const bare = build({
    header: "",
    discord: false
  });
  return {
    text: bare,
    dropped: droppedFrom([]),
    plain: discord,
    tooLong: bare.length > TEXT_LIMIT
  };
}
function HelpTip(props) {
  return (() => {
    var _el$ = _tmpl$97();
    createRenderEffect((_p$) => {
      var _v$ = props.text, _v$2 = props.text;
      _v$ !== _p$.e && setAttribute(_el$, "title", _p$.e = _v$);
      _v$2 !== _p$.t && setAttribute(_el$, "aria-label", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function ModeCard(props) {
  return (() => {
    var _el$2 = _tmpl$225(), _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling;
    addEventListener(_el$2, "click", props.onClick, true);
    insert(_el$3, () => props.title);
    insert(_el$4, () => props.description);
    createRenderEffect((_p$) => {
      var _v$3 = props.selected, _v$4 = `relative flex flex-1 flex-col items-start gap-1 rounded-sm border-2 border-b-4 px-3 pt-2.5 pb-2 text-left transition-all ${props.selected ? "border-[#384B53] border-b-[#F0AF16] bg-[#384B53] text-[#EFEFEF] shadow-xl/20" : "cursor-pointer border-[#8F9094] bg-[#E4E3E7] text-[#384B53] outline-3 outline-transparent hover:border-[#606164] hover:outline-white"}`;
      _v$3 !== _p$.e && setAttribute(_el$2, "aria-selected", _p$.e = _v$3);
      _v$4 !== _p$.t && className(_el$2, _p$.t = _v$4);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$2;
  })();
}
function CheckItem(props) {
  return (() => {
    var _el$5 = _tmpl$415(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
    insert(_el$7, () => props.label, null);
    insert(_el$7, createComponent(Show, {
      get when() {
        return props.detail;
      },
      get children() {
        var _el$8 = _tmpl$319(), _el$9 = _el$8.firstChild, _el$1 = _el$9.nextSibling, _el$0 = _el$1.nextSibling;
        insert(_el$8, () => props.detail, _el$1);
        return _el$8;
      }
    }), null);
    insert(_el$5, createComponent(Show, {
      get when() {
        return props.help;
      },
      children: (help) => createComponent(HelpTip, {
        get text() {
          return help();
        }
      })
    }), null);
    return _el$5;
  })();
}
function ExportModal() {
  const [mode, setMode] = createSignal("export");
  const [errorText, setErrorText] = createSignal("");
  const [shareLink, setShareLink] = createSignal("");
  const [uploading, setUploading] = createSignal(false);
  const [copied, setCopied] = createSignal("");
  const groups = saveIssueGroups;
  const [exportCode, setExportCode] = createSignal("");
  let codeRequest = 0;
  createEffect(() => {
    trackStore(state);
    const request = ++codeRequest;
    void compress().then((code) => {
      if (request === codeRequest) setExportCode(code);
    });
  });
  createEffect(on(() => trackStore(state), () => setShareLink(""), {
    defer: true
  }));
  const copy = async (text, what) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(""), 2e3);
  };
  const score = () => Number.isFinite(state.score) ? state.score : 0;
  const missingFixedKeys = createMemo(() => state.selectedDolls.filter((doll) => sortDisplayEquippedKeys(doll).filter((key) => key !== null && key.type === 1 /* FixedKey */).length < 3).map((doll) => getSelectedDoll(doll).name));
  const checks = createMemo(() => [
    {
      ok: score() > 0,
      label: "Final score",
      detail: "enter the score from the end of the run",
      help: HELP.score
    },
    {
      ok: missingFixedKeys().length === 0,
      label: "Every doll has 3 Fixed Keys",
      detail: `missing: ${missingFixedKeys().join(", ")}`,
      help: HELP.fixedKeys
    },
    // the text box stops at the limit, but an imported timeline can be over it
    {
      ok: state.description.length <= MAX_DESCRIPTION_LENGTH,
      label: "Description",
      detail: `max ${MAX_DESCRIPTION_LENGTH} characters`,
      help: HELP.description
    }
  ]);
  const unmetChecks = () => checks().filter((check) => !check.ok);
  const canShare = () => isShareable() && unmetChecks().length === 0 && !uploading();
  const pageUrl = () => window.location.origin + window.location.pathname;
  const exportFit = createMemo(() => {
    const code = exportCode();
    if (!code) return null;
    const url = `${pageUrl()}?state=${code}`;
    return fitText(headerParts(), localState.exportDiscord, (options) => localState.exportAsLink ? formatLinkText(url, options) : formatExportText(code, options));
  });
  const fittingText = (fit) => fit && !fit.tooLong ? fit.text : "";
  const exportText = () => fittingText(exportFit());
  const shareUrl = (stateId) => `${pageUrl()}?stateId=${stateId}`;
  const shareFit = createMemo(() => {
    const link = shareLink();
    if (!link) return null;
    return fitText(headerParts(), localState.exportDiscord, (options) => formatLinkText(link, options));
  });
  const shareText = () => fittingText(shareFit());
  const shareTranscript = async () => {
    setErrorText("");
    setShareLink("");
    if (!canShare()) return;
    setUploading(true);
    try {
      const encoded = await compress();
      const res = await fetch("https://gunsmoke.arkahnx.technology/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          map: state.map,
          dolls: state.selectedDolls.map((d) => ({
            id: d.id,
            fortification: d.fortification
          })),
          score: state.score,
          description: state.description,
          state: encoded
        })
      });
      const data = await res.json();
      if (data.error) {
        setErrorText(data.error);
        return;
      }
      if (data.result) {
        saveToLocalStorage();
        setShareLink(shareUrl(data.result.stateId));
      }
    } catch (e) {
      setErrorText(e.message);
    } finally {
      setUploading(false);
    }
  };
  const updateScore = (e) => {
    setState(produce((s) => {
      if (e.currentTarget instanceof HTMLInputElement) {
        s.score = parseInt(e.currentTarget.value);
      }
    }));
  };
  const updateDescription = (e) => {
    setState(produce((s) => {
      if (e.currentTarget instanceof HTMLTextAreaElement) {
        s.description = e.currentTarget.value;
      }
    }));
  };
  const issuesRow = (heading) => createComponent(Show, {
    get when() {
      return groups().length;
    },
    get children() {
      var _el$10 = _tmpl$513(), _el$11 = _el$10.firstChild;
      insert(_el$11, heading);
      insert(_el$10, createComponent(Button, {
        onClick: () => setShowIssuesModal(true),
        color: "red",
        design: "custom",
        content: "Fix Issues",
        get badge() {
          return groups().length;
        }
      }), null);
      return _el$10;
    }
  });
  const isLink = (tab) => tab === "share" || localState.exportAsLink;
  const fitStatus = (fit, isLinkText) => createComponent(Show, {
    when: fit,
    children: (f) => (() => {
      var _el$12 = _tmpl$711(), _el$13 = _el$12.firstChild, _el$14 = _el$13.firstChild;
      insert(_el$13, () => f().text.length, _el$14);
      insert(_el$12, createComponent(Show, {
        get when() {
          return f().tooLong;
        },
        get children() {
          var _el$15 = _tmpl$612();
          insert(_el$15, () => isLinkText ? `This timeline makes a ${f().text.length.toLocaleString()}-character link, over the ${TEXT_LIMIT.toLocaleString()}-character limit, so it can't be copied as a link. If this is a completed timeline use share for a short link instead.` : `This timeline's code is ${f().text.length.toLocaleString()} characters, over the ${TEXT_LIMIT.toLocaleString()}-character limit, so it can't be copied. If this is a completed timeline use share for a short link instead.`);
          return _el$15;
        }
      }), null);
      createRenderEffect(() => className(_el$13, `self-end ${f().tooLong ? "font-bold text-[#AE4749]" : "text-[#606164]"}`));
      return _el$12;
    })()
  });
  const option = (key, label, forcedOff = false) => (() => {
    var _el$16 = _tmpl$811(), _el$17 = _el$16.firstChild;
    className(_el$16, `flex items-center gap-1.5 ${forcedOff ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`);
    _el$17.addEventListener("change", (e) => {
      const checked = e.currentTarget.checked;
      setLocalState(produce((s) => {
        s[key] = checked;
      }));
    });
    _el$17.disabled = forcedOff;
    insert(_el$16, label, null);
    createRenderEffect(() => setAttribute(_el$16, "title", forcedOff ? `Turned off: this would make the text longer than ${TEXT_LIMIT.toLocaleString()} characters` : void 0));
    createRenderEffect(() => _el$17.checked = localState[key] && !forcedOff);
    return _el$16;
  })();
  const optionsRow = (tab) => {
    const fit = () => tab === "export" ? exportFit() : shareFit();
    const droppedInclude = (key) => fit()?.dropped.includes(key) ?? false;
    return (() => {
      var _el$18 = _tmpl$98(), _el$19 = _el$18.firstChild, _el$20 = _el$19.nextSibling, _el$21 = _el$20.nextSibling, _el$22 = _el$21.nextSibling;
      insert(_el$20, () => option("exportIncludeSeason", "Season", droppedInclude("season")), null);
      insert(_el$20, () => option("exportIncludeBoss", "Boss", droppedInclude("boss")), null);
      insert(_el$20, () => option("exportIncludeDolls", "Dolls", droppedInclude("dolls")), null);
      insert(_el$22, createComponent(Show, {
        when: tab === "export",
        get children() {
          return option("exportAsLink", "As a link");
        }
      }), null);
      insert(_el$22, () => option("exportDiscord", isLink(tab) ? "Discord link" : "Discord code block", fit()?.plain ?? false), null);
      return _el$18;
    })();
  };
  return [createComponent(ModalHeader, {
    title: "Export / Share"
  }), (() => {
    var _el$23 = _tmpl$05();
    insert(_el$23, createComponent(ModeCard, {
      get selected() {
        return mode() === "export";
      },
      title: "Export",
      description: "For any timelines: export the timeline code",
      onClick: () => setMode("export")
    }), null);
    insert(_el$23, createComponent(ModeCard, {
      get selected() {
        return mode() === "share";
      },
      title: "Share",
      description: "For finished timelines: Upload and share a short link",
      onClick: () => setMode("share")
    }), null);
    return _el$23;
  })(), createComponent(Show, {
    get when() {
      return mode() === "export";
    },
    get children() {
      return [(() => {
        var _el$24 = _tmpl$117(), _el$25 = _el$24.firstChild;
        insert(_el$24, () => issuesRow("Consider fixing issues before exporting"), _el$25);
        insert(_el$24, () => optionsRow("export"), _el$25);
        insert(_el$24, () => fitStatus(exportFit(), localState.exportAsLink), null);
        createRenderEffect(() => setAttribute(_el$25, "placeholder", exportFit()?.tooLong ? "Too long to export, see below" : "Loading..."));
        createRenderEffect(() => _el$25.value = exportText());
        return _el$24;
      })(), createComponent(ModalFooter, {
        styles: "justify-between",
        get children() {
          return [createComponent(Button, {
            onClick: () => setShowExportModal(false),
            color: "dark",
            design: "cancel",
            content: "Close"
          }), createComponent(Button, {
            onClick: () => void copy(exportText(), "code"),
            get disabled() {
              return exportText() === "";
            },
            color: "dark",
            design: "confirm",
            get content() {
              return memo(() => copied() === "code")() ? "Copied!" : localState.exportAsLink ? "Copy Link" : "Copy Code";
            }
          })];
        }
      })];
    }
  }), createComponent(Show, {
    get when() {
      return mode() === "share";
    },
    get children() {
      return [(() => {
        var _el$26 = _tmpl$144(), _el$27 = _el$26.firstChild, _el$30 = _el$27.firstChild, _el$31 = _el$30.firstChild, _el$32 = _el$31.nextSibling, _el$33 = _el$30.nextSibling, _el$34 = _el$33.firstChild, _el$35 = _el$33.nextSibling, _el$36 = _el$35.nextSibling, _el$37 = _el$36.firstChild;
        insert(_el$26, () => issuesRow(`Required to fix ${plural(groups().length, "issue")} before sharing`), _el$27);
        insert(_el$27, createComponent(Show, {
          get when() {
            return unmetChecks().length;
          },
          get children() {
            return [_tmpl$106(), (() => {
              var _el$29 = _tmpl$118();
              insert(_el$29, createComponent(For, {
                get each() {
                  return unmetChecks();
                },
                children: (check) => createComponent(CheckItem, {
                  get label() {
                    return check.label;
                  },
                  get detail() {
                    return check.detail;
                  },
                  get help() {
                    return check.help;
                  }
                })
              }));
              return _el$29;
            })()];
          }
        }), _el$30);
        insert(_el$30, createComponent(HelpTip, {
          get text() {
            return HELP.score;
          }
        }), _el$31);
        _el$32.$$input = updateScore;
        insert(_el$33, createComponent(HelpTip, {
          get text() {
            return HELP.description;
          }
        }), _el$34);
        _el$35.$$input = updateDescription;
        insert(_el$36, () => state.description.length, _el$37);
        insert(_el$26, () => optionsRow("share"), null);
        insert(_el$26, createComponent(Show, {
          get when() {
            return errorText() !== "";
          },
          get children() {
            var _el$38 = _tmpl$126();
            insert(_el$38, errorText);
            return _el$38;
          }
        }), null);
        insert(_el$26, createComponent(Show, {
          get when() {
            return shareLink() !== "";
          },
          get children() {
            return [(() => {
              var _el$39 = _tmpl$134();
              createRenderEffect(() => _el$39.value = shareText());
              return _el$39;
            })(), memo(() => fitStatus(shareFit(), true))];
          }
        }), null);
        createRenderEffect(() => _el$32.value = score() || "");
        createRenderEffect(() => _el$35.value = state.description);
        return _el$26;
      })(), createComponent(ModalFooter, {
        styles: "justify-between",
        get children() {
          return [createComponent(Button, {
            onClick: () => setShowExportModal(false),
            color: "dark",
            design: "cancel",
            content: "Close"
          }), createComponent(Show, {
            get when() {
              return shareLink() !== "";
            },
            get fallback() {
              return createComponent(Button, {
                onClick: () => void shareTranscript(),
                get disabled() {
                  return !canShare();
                },
                color: "dark",
                design: "confirm",
                get content() {
                  return uploading() ? "Uploading..." : "Upload & get link";
                }
              });
            },
            get children() {
              return createComponent(Button, {
                onClick: () => void copy(shareText(), "link"),
                get disabled() {
                  return shareText() === "";
                },
                color: "dark",
                design: "confirm",
                get content() {
                  return copied() === "link" ? "Copied!" : "Copy Link";
                }
              });
            }
          })];
        }
      })];
    }
  })];
}
delegateEvents(["click", "input"]);

// src/components/modals/SkillDisplayModal.tsx
var _tmpl$99 = /* @__PURE__ */ template(`<div class="flex flex-col gap-2 self-center"><div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]"><span>Show all skills and summons:</span></div><div class="text-md mx-3 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Preview</div><div class="flex flex-wrap justify-center gap-1.5">`);
var _tmpl$226 = /* @__PURE__ */ template(`<div class="mx-3 grid grid-cols-2 items-center justify-center gap-1 text-[#384B53]"><span>`);
var _tmpl$320 = /* @__PURE__ */ template(`<div class="flex flex-col gap-1"><div class="drag-ignore cursor-pointer rounded-sm bg-[#384B53] px-1 py-0.5 text-center text-[13px] font-bold tracking-wide text-[#EFEFEF] shadow-sm shadow-black/50">`);
function SkillDisplayModal() {
  const dollInfo = getDollById("d10");
  const basicSkill = dollInfo?.skills?.filter((s) => s.type === 1 /* BasicAttack */) ?? [];
  const passiveSkill = dollInfo?.skills?.filter((s) => s.type === 5 /* Passive */) ?? [];
  const numberedSkills = dollInfo?.skills?.filter((s) => s.type === 3 /* Skill1 */ || s.type === 4 /* Skill2 */ || s.type === 2 /* Ultimate */) ?? [];
  const letteredSkills = dollInfo?.skills?.filter((s) => s.type === 6 /* SkillA */ || s.type === 7 /* SkillB */ || s.type === 8 /* SkillC */) ?? [];
  const moveSkills = dollInfo?.skills?.filter((s) => s.type === 12 /* Move */) ?? [];
  const skills = [...moveSkills, ...basicSkill, ...numberedSkills, ...passiveSkill, ...letteredSkills, endTurnSkill];
  const filteredNotations = skillOrder.map((type) => [type, getNotations(type)]).filter(([_type, values]) => values.length > 0);
  return [createComponent(ModalHeader, {
    title: "Options"
  }), (() => {
    var _el$ = _tmpl$99(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.nextSibling;
    insert(_el$2, createComponent(Dropdown, {
      options: ["always", "only with keys"],
      get value() {
        return localState.alwaysDisplaySkills ? "always" : "only with keys";
      },
      onChange: (value) => {
        updateVisibleSkillOption(value === "always");
      }
    }), null);
    insert(_el$, createComponent(For, {
      each: filteredNotations,
      children: ([notation, values]) => (() => {
        var _el$6 = _tmpl$226(), _el$7 = _el$6.firstChild;
        insert(_el$7, () => `${SkillTypeLabels[notation]} style:`);
        insert(_el$6, createComponent(Dropdown, {
          options: values,
          get value() {
            return getSkillDisplay(notation);
          },
          onChange: (value) => {
            setSkillDisplay(notation, value);
          }
        }), null);
        return _el$6;
      })()
    }), _el$4);
    insert(_el$5, createComponent(For, {
      each: skills,
      children: (skill, _idx) => (() => {
        var _el$8 = _tmpl$320(), _el$9 = _el$8.firstChild;
        insert(_el$8, createComponent(SkillIcon, {
          skill
        }), _el$9);
        insert(_el$9, () => renderActionBySkill(skill));
        createRenderEffect(() => setAttribute(_el$9, "data-skill-id", skill.id));
        return _el$8;
      })()
    }));
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-center",
    get children() {
      return createComponent(Button, {
        onClick: () => {
          setShowSkillDisplayModal(false);
        },
        color: "dark",
        design: "cancel",
        content: "Close"
      });
    }
  })];
}

// src/components/icons/CommonKey.tsx
var _tmpl$100 = /* @__PURE__ */ template(`<svg><g transform=matrix(1,0,0,0.944444,-0.5,-0.555556)><path d=M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8Z style=fill:rgb(63,78,82)></svg>`, false, true, false);
var _tmpl$227 = /* @__PURE__ */ template(`<svg><g transform=matrix(0.470588,0,0,0.444444,22.5294,7.94444)><path d=M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8Z style=fill:rgb(152,154,159)></svg>`, false, true, false);
var _tmpl$321 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 20 20"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-33,-5.5)><g transform=matrix(1.17647,0,0,1.11111,-8.17647,-3.38889)><path d=M43.5,8L50.861,12.5L50.861,21.5L43.5,26L36.139,21.5L36.139,12.5L43.5,8ZM43.5,10.25L37.979,13.625L37.979,20.375L43.5,23.75L49.021,20.375L49.021,13.625L43.5,10.25Z>`);
function CommonKey(props) {
  const color = props.rarity === 3 /* Elite */ ? "A87D36" : props.rarity === 2 /* Standard */ ? "5F5A90" : "5B6468";
  return (() => {
    var _el$ = _tmpl$321(), _el$2 = _el$.firstChild, _el$5 = _el$2.firstChild, _el$6 = _el$5.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => props.rarity !== 3 /* Elite */)() && props.rarity !== 2 /* Standard */;
      },
      get children() {
        return _tmpl$100();
      }
    }), _el$5);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.rarity === 3 /* Elite */ || props.rarity === 2 /* Standard */;
      },
      get children() {
        return _tmpl$227();
      }
    }), _el$5);
    createRenderEffect((_$p) => style(_el$6, `fill:#${color}`, _$p));
    return _el$;
  })();
}

// src/components/icons/FixedKey.tsx
var _tmpl$101 = /* @__PURE__ */ template(`<svg><g transform=matrix(1,0,0,0.894737,-0.5,1.63158)><path d=M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6Z style=fill:rgb(63,78,82)></svg>`, false, true, false);
var _tmpl$228 = /* @__PURE__ */ template(`<svg><g transform=matrix(0.470588,0,0,0.421053,7.17647,8.97368)><path d=M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6Z style=fill:rgb(152,154,159)></svg>`, false, true, false);
var _tmpl$323 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 20 20"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2><g transform=matrix(1,0,0,1,-4,-5.5)><g transform=matrix(1.17647,0,0,1.05263,-3.05882,-0.815789)><path d=M14.5,6L23,15.5L14.5,25L6,15.5L14.5,6ZM14.5,8.375L8.125,15.5L14.5,22.625L20.875,15.5L14.5,8.375Z>`);
function FixedKey(props) {
  const color = props.rarity === 3 /* Elite */ ? "A87D36" : props.rarity === 2 /* Standard */ ? "5F5A90" : "5B6468";
  return (() => {
    var _el$ = _tmpl$323(), _el$2 = _el$.firstChild, _el$5 = _el$2.firstChild, _el$6 = _el$5.firstChild;
    insert(_el$2, createComponent(Show, {
      get when() {
        return memo(() => props.rarity !== 3 /* Elite */)() && props.rarity !== 2 /* Standard */;
      },
      get children() {
        return _tmpl$101();
      }
    }), _el$5);
    insert(_el$2, createComponent(Show, {
      get when() {
        return props.rarity === 3 /* Elite */ || props.rarity === 2 /* Standard */;
      },
      get children() {
        return _tmpl$228();
      }
    }), _el$5);
    createRenderEffect((_$p) => style(_el$6, `fill:#${color}`, _$p));
    return _el$;
  })();
}

// src/components/icons/SmallKey.tsx
function SmallKey(props) {
  if (!props.keyType) return null;
  if (props.keyType === 4 /* AffinityKey */ || props.keyType === 2 /* CommonKey */) {
    return createComponent(CommonKey, {
      get rarity() {
        return props.rarity;
      }
    });
  }
  return createComponent(FixedKey, {
    get rarity() {
      return props.rarity;
    }
  });
}

// src/components/DynamicDollChip.tsx
var _tmpl$107 = /* @__PURE__ */ template(`<div class="h-30 w-23 flex-col overflow-hidden rounded-sm shadow-sm shadow-black/50"><div><div class="absolute top-1 left-1 h-5 w-5"></div><img loading=lazy decoding=async width=90 height=90 class="h-auto w-22.5 object-cover"></div><div class="font-condensed bg-[#1C2A32] p-1 text-center text-[14px] font-bold text-[#EFEFEF]">`, true, false, false);
var _tmpl$229 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-6 w-6 shadow-sm shadow-black/20">`);
function DynamicDollChip(props) {
  const doll = getDollByDollOrSummon(props.target);
  const icon = "icons" in props.target ? props.target.icons.avatar : "icon" in props.target ? props.target.icon : "";
  return (() => {
    var _el$ = _tmpl$107(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.nextSibling, _el$5 = _el$2.nextSibling;
    addEventListener(_el$, "click", props.onClick, true);
    insert(_el$2, (() => {
      var _c$ = memo(() => !!props.selected);
      return () => _c$() && (() => {
        var _el$6 = _tmpl$229();
        insert(_el$6, createComponent(Check, {}));
        return _el$6;
      })();
    })(), _el$3);
    insert(_el$3, createComponent(PhaseIcon, {
      get phase() {
        return doll.phase;
      }
    }));
    setAttribute(_el$4, "src", icon);
    insert(_el$2, createComponent(Show, {
      get when() {
        return isUnreleased(props.target);
      },
      get children() {
        return createComponent(UnreleasedBadge, {});
      }
    }), null);
    insert(_el$5, () => props.target.name);
    createRenderEffect((_p$) => {
      var _v$ = props.style, _v$2 = `relative flex justify-center border-b-4 bg-[#C9C8CD] ${rarityBorderColor(doll.rarity)}`;
      _p$.e = style(_el$, _v$, _p$.e);
      _v$2 !== _p$.t && className(_el$2, _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/modals/FormationModal.tsx
var _tmpl$108 = /* @__PURE__ */ template(`<div class="relative flex flex-wrap items-center justify-start gap-4 px-10 py-8"><div>`);
var _tmpl$230 = /* @__PURE__ */ template(`<div class="absolute bottom-1 left-2 z-10 h-8 w-8"><img class="relative h-full w-full object-cover">`);
var _tmpl$324 = /* @__PURE__ */ template(`<div class="flex items-center gap-3 bg-[#B6BAC6] p-2.5"><div class="flex flex-col gap-3"><div class="flex flex-row gap-3"><div></div><div><div></div><div class=w-6></div></div></div><div class="flex flex-row gap-3"><div class="text-md flex w-12 flex-col items-center justify-center rounded-sm bg-[#354346] shadow-sm shadow-black/50"><div class="relative h-12 w-12"><div class="absolute z-10"></div><div class="absolute z-20 flex h-full w-full items-center justify-center pt-0.5 text-[18px] font-bold"></div></div><div class="flex flex-row gap-2 text-sm font-bold"><button>-</button><button>+</button></div></div><div class="text-md flex w-14 flex-col items-center justify-center rounded-sm bg-[#354346] px-1 pt-1 shadow-sm shadow-black/50"><div class="relative h-12 w-12 overflow-hidden rounded-full"><img><div class="absolute top-0 right-0 bottom-0 left-0 flex items-end justify-center bg-linear-to-t from-black/50 via-black/20 to-transparent px-1 text-xs font-bold text-[#EFEFEF]"><div class="overflow-hidden overflow-ellipsis whitespace-nowrap"></div></div></div><div class="flex flex-row gap-2 text-sm font-bold"><button>-</button><button>+</button></div></div><div><img><div></div></div><div class="flex w-14 flex-col gap-3 text-sm font-bold tracking-wide"><button></button><button>Load`);
var _tmpl$416 = /* @__PURE__ */ template(`<div class="flex h-7 w-4 items-center justify-center">=`);
var _tmpl$514 = /* @__PURE__ */ template(`<div class="h-5 w-5">`);
function FormationModal() {
  const confirm = async () => {
    setShowFormationModal(false);
    await updateSelectedDolls();
  };
  return (() => {
    var _el$ = _tmpl$108(), _el$2 = _el$.firstChild;
    insert(_el$, createComponent(For, {
      each: tempSelectedDolls,
      children: (doll) => {
        const [savedLoadout, setSavedLoadout] = createSignal(false);
        const dollInfo = getSelectedDoll(doll);
        const dollFortification2 = createMemo(() => doll.fortification || "\u2014");
        const dollRemolding = createMemo(() => "Lv." + String(doll.remoldingLvl));
        const dollWeapon = createMemo(() => (
          // an unknown weapon (reported by validateSave) displays as the doll's signature weapon
          isRenderable({
            kind: "dollWeapon" /* DollWeapon */,
            dollId: doll.id
          }) ? getWeaponById(doll.gun) : getWeaponByDollId(doll.id)
        ));
        const weaponChibi = createMemo(() => {
          return getDollChibiIconByWeapon(dollWeapon());
        });
        const hasLoadout = createMemo(() => dollHasLoadout(doll.id));
        const keys = createMemo(() => displaySmallKeys(doll));
        return (() => {
          var _el$3 = _tmpl$324(), _el$4 = _el$3.firstChild, _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$8.nextSibling, _el$0 = _el$5.nextSibling, _el$1 = _el$0.firstChild, _el$10 = _el$1.firstChild, _el$11 = _el$10.firstChild, _el$12 = _el$11.nextSibling, _el$13 = _el$10.nextSibling, _el$14 = _el$13.firstChild, _el$15 = _el$14.nextSibling, _el$16 = _el$1.nextSibling, _el$17 = _el$16.firstChild, _el$18 = _el$17.firstChild, _el$19 = _el$18.nextSibling, _el$20 = _el$19.firstChild, _el$21 = _el$17.nextSibling, _el$22 = _el$21.firstChild, _el$23 = _el$22.nextSibling, _el$24 = _el$16.nextSibling, _el$27 = _el$24.firstChild, _el$28 = _el$27.nextSibling, _el$29 = _el$24.nextSibling, _el$30 = _el$29.firstChild, _el$31 = _el$30.nextSibling;
          insert(_el$3, createComponent(DynamicDollChip, {
            target: dollInfo
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
            children: (key) => typeof key === "string" ? _tmpl$416() : key ? (() => {
              var _el$33 = _tmpl$514();
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
          _el$7.$$click = () => {
            changeBorrow(doll.id);
          };
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
              return dollWeapon().dollId;
            },
            get children() {
              var _el$25 = _tmpl$230(), _el$26 = _el$25.firstChild;
              createRenderEffect(() => setAttribute(_el$26, "src", weaponChibi()));
              return _el$25;
            }
          }), _el$27);
          insert(_el$24, createComponent(Show, {
            get when() {
              return dollWeapon().unreleased;
            },
            get children() {
              return createComponent(UnreleasedBadge, {
                "class": "top-1 left-1 z-30 text-xs"
              });
            }
          }), _el$28);
          _el$30.$$click = () => {
            setSavedLoadout(true);
            saveDollLoadout(doll.id);
          };
          insert(_el$30, () => savedLoadout() ? "Saved" : "Save");
          _el$31.$$click = () => {
            if (dollHasLoadout(doll.id)) {
              loadDollLoadout(doll.id);
            }
          };
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(false)} text-md flex h-10 grow flex-row items-center justify-center gap-1 rounded-sm bg-[#354346] p-1 shadow-sm shadow-black/50`, _v$2 = `${interactiveStyles(doll.borrow)} text-md flex h-10 flex-row items-center justify-center gap-1 rounded-sm bg-[#354346] p-1 shadow-sm shadow-black/50`, _v$3 = `${doll.borrow ? "opacity-100" : "opacity-20"} w-5`, _v$4 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$5 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$6 = dollInfo.icons.remolding, _v$7 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$8 = `${interactiveStyles(false)} flex h-4 w-4 items-center justify-center rounded-sm`, _v$9 = `${interactiveStyles(false)} relative h-17 w-31.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50`, _v$0 = dollWeapon().icon, _v$1 = `relative z-20 h-full w-full border-b-3 ${rarityBorderColor(dollWeapon().rarity)} object-cover`, _v$10 = `absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${rarityGradientColor(dollWeapon().rarity)} from-0% to-transparent to-75%`, _v$11 = `${interactiveStyles(false)} rounded-sm bg-[#354346] px-2 py-1 shadow-sm shadow-black/50`, _v$12 = `${hasLoadout() ? interactiveStyles(false) : "opacity-50"} rounded-sm bg-[#354346] px-2 py-1 shadow-sm shadow-black/50`;
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
      onClick: () => void confirm(),
      color: "light",
      design: "confirm"
    }));
    createRenderEffect(() => className(_el$2, tempSelectedDolls.length % 2 === 1 ? "absolute right-10 bottom-8 flex justify-end gap-3" : "flex grow justify-end gap-3"));
    return _el$;
  })();
}
delegateEvents(["click"]);

// src/components/icons/EmptyKey.tsx
var _tmpl$109 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 62 62"xmlns=http://www.w3.org/2000/svg xmlns:xlink=http://www.w3.org/1999/xlink style=fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5><g transform=matrix(1.20833,0,0,1.38095,-22.1667,-18.7143)><ellipse cx=44 cy=36 rx=24 ry=21></ellipse></g><g transform=matrix(2,0,0,1,-29,0.5)><path d=M29,32.5L24.75,32.5L24.75,28.5L29,28.5L29,20L31,20L31,28.5L35.25,28.5L35.25,32.5L31,32.5L31,41L29,41L29,32.5Z>`);
function EmptyKey(props) {
  return (() => {
    var _el$ = _tmpl$109(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$2.nextSibling, _el$5 = _el$4.firstChild;
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

// src/components/icons/Lock.tsx
var _tmpl$119 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 16 16"xmlns=http://www.w3.org/2000/svg><path d="M4.5 7V5A3.5 3.5 0 0 1 11.5 5V7H10V5A2 2 0 0 0 6 5V7Z"style=fill:currentColor></path><path d="M2.5 7H13.5V15H2.5Z"style=fill:currentColor></path><path d="M7.25 9.5H8.75V12.5H7.25Z"style=fill:#1C2A32>`);
function Lock() {
  return _tmpl$119();
}

// src/components/icons/ThumbsUp.tsx
var _tmpl$120 = /* @__PURE__ */ template(`<svg width=100% height=100% viewBox="0 0 16 16"xmlns=http://www.w3.org/2000/svg><path d="M1 7H4V15H1Z"style=fill:currentColor></path><path d="M5 7.2L8.4 1.6C8.9 0.8 10.2 1.1 10.2 2.1V5.6H14C14.7 5.6 15.2 6.2 15.1 6.9L14 13.9C13.9 14.5 13.4 15 12.8 15H5Z"style=fill:currentColor>`);
function ThumbsUp() {
  return _tmpl$120();
}

// node_modules/fuse.js/dist/fuse.mjs
function isArray(value) {
  return !Array.isArray ? getTag(value) === "[object Array]" : Array.isArray(value);
}
function baseToString(value) {
  if (typeof value == "string") return value;
  if (typeof value === "bigint") return value.toString();
  const result = value + "";
  return result == "0" && 1 / value == -Infinity ? "-0" : result;
}
function toString(value) {
  return value == null ? "" : baseToString(value);
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number";
}
function isBoolean(value) {
  return value === true || value === false || isObjectLike(value) && getTag(value) == "[object Boolean]";
}
function isObject(value) {
  return typeof value === "object";
}
function isObjectLike(value) {
  return isObject(value) && value !== null;
}
function isDefined(value) {
  return value !== void 0 && value !== null;
}
function isBlank(value) {
  return !value.trim().length;
}
function getTag(value) {
  return value == null ? value === void 0 ? "[object Undefined]" : "[object Null]" : Object.prototype.toString.call(value);
}
var INCORRECT_INDEX_TYPE = "Incorrect 'index' type";
var INVALID_DOC_INDEX = "Invalid doc index: must be a non-negative integer within the bounds of the docs array";
var LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) => `Invalid value for key ${key}`;
var PATTERN_LENGTH_TOO_LARGE = (max) => `Pattern length exceeds max of ${max}.`;
var MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;
var INVALID_KEY_WEIGHT_VALUE = (key) => `Property 'weight' in key '${key}' must be a positive integer`;
var FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED = "Fuse.match does not support useTokenSearch: token search requires corpus-level statistics (df, fieldCount) that a one-off string comparison does not have. Use new Fuse(...).search(...) instead.";
var hasOwn = Object.prototype.hasOwnProperty;
var KeyStore = class {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};
    let totalWeight = 0;
    keys.forEach((key) => {
      const obj = createKey(key);
      this._keys.push(obj);
      this._keyMap[obj.id] = obj;
      totalWeight += obj.weight;
    });
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId];
  }
  keys() {
    return this._keys;
  }
  toJSON() {
    return JSON.stringify(this._keys);
  }
};
function createKey(key) {
  let path = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;
  if (isString(key) || isArray(key)) {
    src = key;
    path = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, "name")) throw new Error(MISSING_KEY_PROPERTY("name"));
    const name = key.name;
    src = name;
    if (hasOwn.call(key, "weight") && key.weight !== void 0) {
      weight = key.weight;
      if (weight <= 0) throw new Error(INVALID_KEY_WEIGHT_VALUE(createKeyId(name)));
    }
    path = createKeyPath(name);
    id = createKeyId(name);
    getFn = key.getFn ?? null;
  }
  return {
    path,
    id,
    weight,
    src,
    getFn
  };
}
function createKeyPath(key) {
  return isArray(key) ? key : key.split(".");
}
function createKeyId(key) {
  return isArray(key) ? key.join(".") : key;
}
function get(obj, path) {
  const list = [];
  let arr = false;
  const deepGet = (obj2, path2, index, arrayIndex) => {
    if (!isDefined(obj2)) return;
    if (!path2[index]) list.push(arrayIndex !== void 0 ? {
      v: obj2,
      i: arrayIndex
    } : obj2);
    else {
      const value = obj2[path2[index]];
      if (!isDefined(value)) return;
      if (index === path2.length - 1 && (isString(value) || isNumber(value) || isBoolean(value) || typeof value === "bigint")) list.push(arrayIndex !== void 0 ? {
        v: toString(value),
        i: arrayIndex
      } : toString(value));
      else if (isArray(value)) {
        arr = true;
        for (let i = 0, len = value.length; i < len; i += 1) deepGet(value[i], path2, index + 1, i);
      } else if (path2.length) deepGet(value, path2, index + 1, arrayIndex);
    }
  };
  deepGet(obj, isString(path) ? path.split(".") : path, 0);
  return arr ? list : list[0];
}
var MatchOptions = {
  includeMatches: false,
  findAllMatches: false,
  minMatchCharLength: 1
};
var BasicOptions = {
  isCaseSensitive: false,
  ignoreDiacritics: false,
  includeScore: false,
  keys: [],
  shouldSort: true,
  sortFn: (a, b) => a.score === b.score ? a.idx < b.idx ? -1 : 1 : a.score < b.score ? -1 : 1
};
var FuzzyOptions = {
  location: 0,
  threshold: 0.6,
  distance: 100
};
var AdvancedOptions = {
  useExtendedSearch: false,
  useTokenSearch: false,
  tokenize: void 0,
  tokenMatch: "any",
  getFn: get,
  ignoreLocation: false,
  ignoreFieldNorm: false,
  fieldNormWeight: 1
};
var Config = Object.freeze({
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
});
function norm(weight = 1, mantissa = 3) {
  const cache = /* @__PURE__ */ new Map();
  const m = Math.pow(10, mantissa);
  return {
    get(value) {
      let numTokens = 1;
      let inSpace = false;
      for (let i = 0; i < value.length; i++) if (value.charCodeAt(i) === 32) {
        if (!inSpace) {
          numTokens++;
          inSpace = true;
        }
      } else inSpace = false;
      if (cache.has(numTokens)) return cache.get(numTokens);
      const n = Math.round(m / Math.pow(numTokens, 0.5 * weight)) / m;
      cache.set(numTokens, n);
      return n;
    },
    clear() {
      cache.clear();
    }
  };
}
var FuseIndex = class {
  constructor({ getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;
    this.docs = [];
    this.keys = [];
    this._keysMap = {};
    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length) return;
    this.isCreated = true;
    const len = this.docs.length;
    this.records = new Array(len);
    let recordCount = 0;
    if (isString(this.docs[0])) for (let i = 0; i < len; i++) {
      const record = this._createStringRecord(this.docs[i], i);
      if (record) this.records[recordCount++] = record;
    }
    else for (let i = 0; i < len; i++) this.records[recordCount++] = this._createObjectRecord(this.docs[i], i);
    this.records.length = recordCount;
    this.norm.clear();
  }
  add(doc, docIndex) {
    if (!Number.isInteger(docIndex) || docIndex < 0) throw new Error(INVALID_DOC_INDEX);
    if (isString(doc)) {
      const record2 = this._createStringRecord(doc, docIndex);
      if (record2) this.records.push(record2);
      return record2;
    }
    const record = this._createObjectRecord(doc, docIndex);
    this.records.push(record);
    return record;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0) throw new Error(INVALID_DOC_INDEX);
    for (let i = 0, len = this.records.length; i < len; i += 1) if (this.records[i].i === idx) {
      this.records.splice(i, 1);
      break;
    }
    for (let i = 0, len = this.records.length; i < len; i += 1) if (this.records[i].i > idx) this.records[i].i -= 1;
  }
  removeAll(indices) {
    const toRemove = /* @__PURE__ */ new Set();
    for (const v of indices) if (Number.isInteger(v) && v >= 0) toRemove.add(v);
    if (toRemove.size === 0) return;
    this.records = this.records.filter((r) => !toRemove.has(r.i));
    const sorted = Array.from(toRemove).sort((a, b) => a - b);
    for (const record of this.records) {
      let lo = 0;
      let hi = sorted.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (sorted[mid] < record.i) lo = mid + 1;
        else hi = mid;
      }
      record.i -= lo;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]];
  }
  size() {
    return this.records.length;
  }
  _createStringRecord(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc)) return null;
    return {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };
  }
  _createObjectRecord(doc, docIndex) {
    const record = {
      i: docIndex,
      $: {}
    };
    for (let keyIndex = 0, keyLen = this.keys.length; keyIndex < keyLen; keyIndex++) {
      const key = this.keys[keyIndex];
      const value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);
      if (!isDefined(value)) continue;
      if (isArray(value)) {
        const subRecords = [];
        for (let i = 0, len = value.length; i < len; i += 1) {
          const item = value[i];
          if (!isDefined(item)) continue;
          if (isString(item)) {
            if (!isBlank(item)) {
              const subRecord = {
                v: item,
                i,
                n: this.norm.get(item)
              };
              subRecords.push(subRecord);
            }
          } else if (isDefined(item.v)) {
            const text = isString(item.v) ? item.v : toString(item.v);
            if (!isBlank(text)) {
              const subRecord = {
                v: text,
                i: item.i,
                n: this.norm.get(text)
              };
              subRecords.push(subRecord);
            }
          }
        }
        record.$[keyIndex] = subRecords;
      } else if (isString(value) && !isBlank(value)) {
        const subRecord = {
          v: value,
          n: this.norm.get(value)
        };
        record.$[keyIndex] = subRecord;
      }
    }
    return record;
  }
  toJSON() {
    return {
      keys: this.keys.map(({ getFn, ...key }) => key),
      records: this.records
    };
  }
};
function createIndex(keys, docs, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex;
}
function parseIndex(data, { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({
    getFn,
    fieldNormWeight
  });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex;
}
function convertMaskToIndices(matchmask = [], minMatchCharLength = Config.minMatchCharLength) {
  const indices = [];
  let start = -1;
  let end = -1;
  let i = 0;
  for (let len = matchmask.length; i < len; i += 1) {
    const match = matchmask[i];
    if (match && start === -1) start = i;
    else if (!match && start !== -1) {
      end = i - 1;
      if (end - start + 1 >= minMatchCharLength) indices.push([start, end]);
      start = -1;
    }
  }
  if (matchmask[i - 1] && i - start >= minMatchCharLength) indices.push([start, i - 1]);
  return indices;
}
function search(text, pattern, patternAlphabet, { location: location2 = Config.location, distance: distance2 = Config.distance, threshold = Config.threshold, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, includeMatches = Config.includeMatches, ignoreLocation = Config.ignoreLocation } = {}) {
  if (pattern.length > 32) throw new Error(PATTERN_LENGTH_TOO_LARGE(32));
  const patternLen = pattern.length;
  const textLen = text.length;
  const expectedLocation = Math.max(0, Math.min(location2, textLen));
  let currentThreshold = threshold;
  let bestLocation = expectedLocation;
  const calcScore = (errors, currentLocation) => {
    const accuracy = errors / patternLen;
    if (ignoreLocation) return accuracy;
    const proximity = Math.abs(expectedLocation - currentLocation);
    if (!distance2) return proximity ? 1 : accuracy;
    return accuracy + proximity / distance2;
  };
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  const matchMask = computeMatches ? Array(textLen) : [];
  let index;
  while ((index = text.indexOf(pattern, bestLocation)) > -1) {
    const score = calcScore(0, index);
    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;
    if (computeMatches) {
      let i = 0;
      while (i < patternLen) {
        matchMask[index + i] = 1;
        i += 1;
      }
    }
  }
  bestLocation = -1;
  let lastBitArr = [];
  let finalScore = 1;
  let bestErrors = 0;
  let binMax = patternLen + textLen;
  const mask = 1 << patternLen - 1;
  for (let i = 0; i < patternLen; i += 1) {
    let binMin = 0;
    let binMid = binMax;
    while (binMin < binMid) {
      if (calcScore(i, expectedLocation + binMid) <= currentThreshold) binMin = binMid;
      else binMax = binMid;
      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }
    binMax = binMid;
    let start = Math.max(1, expectedLocation - binMid + 1);
    const finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen;
    const bitArr = Array(finish + 2);
    bitArr[finish + 1] = (1 << i) - 1;
    for (let j = finish; j >= start; j -= 1) {
      const currentLocation = j - 1;
      const charMatch = patternAlphabet[text[currentLocation]];
      bitArr[j] = (bitArr[j + 1] << 1 | 1) & charMatch;
      if (i) bitArr[j] |= (lastBitArr[j + 1] | lastBitArr[j]) << 1 | 1 | lastBitArr[j + 1];
      if (bitArr[j] & mask) {
        finalScore = calcScore(i, currentLocation);
        if (finalScore <= currentThreshold) {
          currentThreshold = finalScore;
          bestLocation = currentLocation;
          bestErrors = i;
          if (bestLocation <= expectedLocation) break;
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }
    if (calcScore(i + 1, expectedLocation) > currentThreshold) break;
    lastBitArr = bitArr;
  }
  if (computeMatches && bestLocation >= 0) {
    const matchEnd = Math.min(textLen - 1, bestLocation + patternLen - 1 + bestErrors);
    for (let k = bestLocation; k <= matchEnd; k += 1) if (patternAlphabet[text[k]]) matchMask[k] = 1;
  }
  const result = {
    isMatch: bestLocation >= 0,
    score: Math.max(1e-3, finalScore)
  };
  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length) result.isMatch = false;
    else if (includeMatches) result.indices = indices;
  }
  return result;
}
function createPatternAlphabet(pattern) {
  const mask = {};
  for (let i = 0, len = pattern.length; i < len; i += 1) {
    const char = pattern.charAt(i);
    mask[char] = (mask[char] || 0) | 1 << len - i - 1;
  }
  return mask;
}
function mergeIndices(indices) {
  if (indices.length <= 1) return indices;
  indices.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [indices[0]];
  for (let i = 1, len = indices.length; i < len; i += 1) {
    const last = merged[merged.length - 1];
    const curr = indices[i];
    if (curr[0] <= last[1] + 1) last[1] = Math.max(last[1], curr[1]);
    else merged.push(curr);
  }
  return merged;
}
var NON_DECOMPOSABLE_MAP = {
  "\u0142": "l",
  "\u0141": "L",
  "\u0111": "d",
  "\u0110": "D",
  "\xF8": "o",
  "\xD8": "O",
  "\u0127": "h",
  "\u0126": "H",
  "\u0167": "t",
  "\u0166": "T",
  "\u0131": "i",
  "\xDF": "ss"
};
var NON_DECOMPOSABLE_RE = new RegExp("[" + Object.keys(NON_DECOMPOSABLE_MAP).join("") + "]", "g");
var stripDiacritics = typeof String.prototype.normalize === "function" ? (str) => str.normalize("NFD").replace(/[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08D3-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A70\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0D00-\u0D03\u0D3B\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0F18\u0F19\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u1885\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ABE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DF9\u1DFB-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA66F-\uA672\uA674-\uA67D\uA69E\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F]/g, "").replace(NON_DECOMPOSABLE_RE, (ch) => NON_DECOMPOSABLE_MAP[ch]) : (str) => str;
var BitapSearch = class {
  constructor(pattern, { location: location2 = Config.location, threshold = Config.threshold, distance: distance2 = Config.distance, includeMatches = Config.includeMatches, findAllMatches = Config.findAllMatches, minMatchCharLength = Config.minMatchCharLength, isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, ignoreLocation = Config.ignoreLocation } = {}) {
    this.options = {
      location: location2,
      threshold,
      distance: distance2,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreDiacritics,
      ignoreLocation
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.chunks = [];
    if (!this.pattern.length) return;
    const addChunk = (pattern2, startIndex) => {
      this.chunks.push({
        pattern: pattern2,
        alphabet: createPatternAlphabet(pattern2),
        startIndex
      });
    };
    const len = this.pattern.length;
    if (len > 32) {
      let i = 0;
      const remainder = len % 32;
      const end = len - remainder;
      while (i < end) {
        addChunk(this.pattern.substr(i, 32), i);
        i += 32;
      }
      if (remainder) {
        const startIndex = len - 32;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else addChunk(this.pattern, 0);
  }
  searchIn(text) {
    const { isCaseSensitive, ignoreDiacritics, includeMatches } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    if (this.pattern === text) {
      const result2 = {
        isMatch: true,
        score: 0
      };
      if (includeMatches) result2.indices = [[0, text.length - 1]];
      return result2;
    }
    const { location: location2, distance: distance2, threshold, findAllMatches, minMatchCharLength, ignoreLocation } = this.options;
    const allIndices = [];
    let totalScore = 0;
    let hasMatches = false;
    this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern, alphabet, {
        location: location2 + startIndex,
        distance: distance2,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });
      if (isMatch) hasMatches = true;
      totalScore += score;
      if (isMatch && indices) allIndices.push(...indices);
    });
    const result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };
    if (hasMatches && includeMatches) result.indices = mergeIndices(allIndices);
    return result;
  }
};
var MULTI_MATCH_TYPES = /* @__PURE__ */ new Set(["fuzzy", "include"]);
function isInverse(type) {
  return type.startsWith("inverse");
}
var matchers = [
  {
    type: "exact",
    multiRegex: /^="(.*)"$/,
    singleRegex: /^=(.*)$/,
    create: (pattern) => ({
      type: "exact",
      search(text) {
        const isMatch = text === pattern;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, pattern.length - 1]
        };
      }
    })
  },
  {
    type: "include",
    multiRegex: /^'"(.*)"$/,
    singleRegex: /^'(.*)$/,
    create: (pattern) => ({
      type: "include",
      search(text) {
        let location2 = 0;
        let index;
        const indices = [];
        const patternLen = pattern.length;
        while ((index = text.indexOf(pattern, location2)) > -1) {
          location2 = index + patternLen;
          indices.push([index, location2 - 1]);
        }
        const isMatch = !!indices.length;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices
        };
      }
    })
  },
  {
    type: "prefix-exact",
    multiRegex: /^\^"(.*)"$/,
    singleRegex: /^\^(.*)$/,
    create: (pattern) => ({
      type: "prefix-exact",
      search(text) {
        const isMatch = text.startsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, pattern.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-prefix-exact",
    multiRegex: /^!\^"(.*)"$/,
    singleRegex: /^!\^(.*)$/,
    create: (pattern) => ({
      type: "inverse-prefix-exact",
      search(text) {
        const isMatch = !text.startsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-suffix-exact",
    multiRegex: /^!"(.*)"\$$/,
    singleRegex: /^!(.*)\$$/,
    create: (pattern) => ({
      type: "inverse-suffix-exact",
      search(text) {
        const isMatch = !text.endsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "suffix-exact",
    multiRegex: /^"(.*)"\$$/,
    singleRegex: /^(.*)\$$/,
    create: (pattern) => ({
      type: "suffix-exact",
      search(text) {
        const isMatch = text.endsWith(pattern);
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [text.length - pattern.length, text.length - 1]
        };
      }
    })
  },
  {
    type: "inverse-exact",
    multiRegex: /^!"(.*)"$/,
    singleRegex: /^!(.*)$/,
    create: (pattern) => ({
      type: "inverse-exact",
      search(text) {
        const isMatch = text.indexOf(pattern) === -1;
        return {
          isMatch,
          score: isMatch ? 0 : 1,
          indices: [0, text.length - 1]
        };
      }
    })
  },
  {
    type: "fuzzy",
    multiRegex: /^"(.*)"$/,
    singleRegex: /^(.*)$/,
    create: (pattern, options = {}) => {
      const bitap = new BitapSearch(pattern, {
        location: options.location ?? Config.location,
        threshold: options.threshold ?? Config.threshold,
        distance: options.distance ?? Config.distance,
        includeMatches: options.includeMatches ?? Config.includeMatches,
        findAllMatches: options.findAllMatches ?? Config.findAllMatches,
        minMatchCharLength: options.minMatchCharLength ?? Config.minMatchCharLength,
        isCaseSensitive: options.isCaseSensitive ?? Config.isCaseSensitive,
        ignoreDiacritics: options.ignoreDiacritics ?? Config.ignoreDiacritics,
        ignoreLocation: options.ignoreLocation ?? Config.ignoreLocation
      });
      return {
        type: "fuzzy",
        search(text) {
          return bitap.searchIn(text);
        }
      };
    }
  }
];
var matchersLen = matchers.length;
var ESCAPED_PIPE = "\0";
var OR_TOKEN = "|";
function tokenize(pattern) {
  const tokens = [];
  const len = pattern.length;
  let i = 0;
  while (i < len) {
    while (i < len && pattern[i] === " ") i++;
    if (i >= len) break;
    let j = i;
    while (j < len && pattern[j] !== " " && pattern[j] !== '"') j++;
    if (j < len && pattern[j] === '"') {
      j++;
      while (j < len) {
        if (pattern[j] === '"') {
          const next = j + 1;
          if (next >= len || pattern[next] === " ") {
            j++;
            break;
          }
          if (pattern[next] === "$" && (next + 1 >= len || pattern[next + 1] === " ")) {
            j += 2;
            break;
          }
        }
        j++;
      }
      tokens.push(pattern.substring(i, j));
      i = j;
    } else {
      while (j < len && pattern[j] !== " ") j++;
      tokens.push(pattern.substring(i, j));
      i = j;
    }
  }
  return tokens;
}
function getMatch(pattern, exp) {
  const matches = pattern.match(exp);
  return matches ? matches[1] : null;
}
function parseQuery(pattern, options = {}) {
  return pattern.replace(/\\\|/g, ESCAPED_PIPE).split(OR_TOKEN).map((item) => {
    const query = tokenize(item.replace(/\u0000/g, "|").trim()).filter((item2) => item2 && !!item2.trim());
    const results = [];
    for (let i = 0, len = query.length; i < len; i += 1) {
      const queryItem = query[i];
      let found = false;
      let idx = -1;
      while (!found && ++idx < matchersLen) {
        const def = matchers[idx];
        const token = getMatch(queryItem, def.multiRegex);
        if (token) {
          results.push(def.create(token, options));
          found = true;
        }
      }
      if (found) continue;
      idx = -1;
      while (++idx < matchersLen) {
        const def = matchers[idx];
        const token = getMatch(queryItem, def.singleRegex);
        if (token) {
          results.push(def.create(token, options));
          break;
        }
      }
    }
    return results;
  });
}
var ExtendedSearch = class {
  constructor(pattern, { isCaseSensitive = Config.isCaseSensitive, ignoreDiacritics = Config.ignoreDiacritics, includeMatches = Config.includeMatches, minMatchCharLength = Config.minMatchCharLength, ignoreLocation = Config.ignoreLocation, findAllMatches = Config.findAllMatches, location: location2 = Config.location, threshold = Config.threshold, distance: distance2 = Config.distance } = {}) {
    this.query = null;
    this.options = {
      isCaseSensitive,
      ignoreDiacritics,
      includeMatches,
      minMatchCharLength,
      findAllMatches,
      ignoreLocation,
      location: location2,
      threshold,
      distance: distance2
    };
    pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    pattern = ignoreDiacritics ? stripDiacritics(pattern) : pattern;
    this.pattern = pattern;
    this.query = parseQuery(this.pattern, this.options);
  }
  static condition(_, options) {
    return options.useExtendedSearch;
  }
  searchIn(text) {
    const query = this.query;
    if (!query) return {
      isMatch: false,
      score: 1
    };
    const { includeMatches, isCaseSensitive, ignoreDiacritics } = this.options;
    text = isCaseSensitive ? text : text.toLowerCase();
    text = ignoreDiacritics ? stripDiacritics(text) : text;
    let numMatches = 0;
    const allIndices = [];
    let totalScore = 0;
    let hasInverse = false;
    for (let i = 0, qLen = query.length; i < qLen; i += 1) {
      const searchers = query[i];
      allIndices.length = 0;
      numMatches = 0;
      hasInverse = false;
      for (let j = 0, pLen = searchers.length; j < pLen; j += 1) {
        const matcher = searchers[j];
        const { isMatch, indices, score } = matcher.search(text);
        if (isMatch) {
          numMatches += 1;
          totalScore += score;
          if (isInverse(matcher.type)) hasInverse = true;
          if (includeMatches) if (MULTI_MATCH_TYPES.has(matcher.type)) allIndices.push(...indices);
          else allIndices.push(indices);
        } else {
          totalScore = 0;
          numMatches = 0;
          allIndices.length = 0;
          hasInverse = false;
          break;
        }
      }
      if (numMatches) {
        const result = {
          isMatch: true,
          score: totalScore / numMatches
        };
        if (hasInverse) result.hasInverse = true;
        if (includeMatches) result.indices = mergeIndices(allIndices);
        return result;
      }
    }
    return {
      isMatch: false,
      score: 1
    };
  }
};
var registeredSearchers = [];
function register(...args) {
  registeredSearchers.push(...args);
}
function createSearcher(pattern, options) {
  for (let i = 0, len = registeredSearchers.length; i < len; i += 1) {
    const searcherClass = registeredSearchers[i];
    if (searcherClass.condition(pattern, options)) return new searcherClass(pattern, options);
  }
  return new BitapSearch(pattern, options);
}
var LogicalOperator = {
  AND: "$and",
  OR: "$or"
};
var KeyType2 = {
  PATH: "$path",
  PATTERN: "$val"
};
var isExpression = (query) => !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);
var isPath = (query) => !!query[KeyType2.PATH];
var isLeaf = (query) => !isArray(query) && isObject(query) && !isExpression(query);
var convertToExplicit = (query) => ({ [LogicalOperator.AND]: Object.keys(query).map((key) => ({ [key]: query[key] })) });
function parse(query, options, { auto = true } = {}) {
  const next = (query2) => {
    if (isString(query2)) {
      const obj = {
        keyId: null,
        pattern: query2
      };
      if (auto) obj.searcher = createSearcher(query2, options);
      return obj;
    }
    const keys = Object.keys(query2);
    const isQueryPath = isPath(query2);
    if (!isQueryPath && keys.length > 1 && !isExpression(query2)) return next(convertToExplicit(query2));
    if (isLeaf(query2)) {
      const key = isQueryPath ? query2[KeyType2.PATH] : keys[0];
      const pattern = isQueryPath ? query2[KeyType2.PATTERN] : query2[key];
      if (!isString(pattern)) throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key));
      const obj = {
        keyId: createKeyId(key),
        pattern
      };
      if (auto) obj.searcher = createSearcher(pattern, options);
      return obj;
    }
    const node = {
      children: [],
      operator: keys[0]
    };
    keys.forEach((key) => {
      const value = query2[key];
      if (isArray(value)) value.forEach((item) => {
        node.children.push(next(item));
      });
    });
    return node;
  };
  if (!isExpression(query)) query = convertToExplicit(query);
  return next(query);
}
function computeScoreSingle(matches, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  let totalScore = 1;
  matches.forEach(({ key, norm: norm2, score }) => {
    const weight = key ? key.weight : null;
    totalScore *= Math.pow(score === 0 && weight ? Number.EPSILON : score, (weight || 1) * (ignoreFieldNorm ? 1 : norm2));
  });
  return totalScore;
}
function computeScore(results, { ignoreFieldNorm = Config.ignoreFieldNorm }) {
  results.forEach((result) => {
    result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
  });
}
var MaxHeap = class {
  constructor(limit) {
    this.limit = limit;
    this.heap = [];
  }
  get size() {
    return this.heap.length;
  }
  shouldInsert(score) {
    return this.size < this.limit || score < this.heap[0].score;
  }
  insert(item) {
    if (this.size < this.limit) {
      this.heap.push(item);
      this._bubbleUp(this.size - 1);
    } else if (item.score < this.heap[0].score) {
      this.heap[0] = item;
      this._sinkDown(0);
    }
  }
  extractSorted(sortFn) {
    return this.heap.sort(sortFn);
  }
  _bubbleUp(i) {
    const heap = this.heap;
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (heap[i].score <= heap[parent].score) break;
      const tmp = heap[i];
      heap[i] = heap[parent];
      heap[parent] = tmp;
      i = parent;
    }
  }
  _sinkDown(i) {
    const heap = this.heap;
    const len = heap.length;
    let largest = i;
    do {
      i = largest;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < len && heap[left].score > heap[largest].score) largest = left;
      if (right < len && heap[right].score > heap[largest].score) largest = right;
      if (largest !== i) {
        const tmp = heap[i];
        heap[i] = heap[largest];
        heap[largest] = tmp;
      }
    } while (largest !== i);
  }
};
function formatMatches(result) {
  const matches = [];
  result.matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length) return;
    const obj = {
      indices: match.indices,
      value: match.value
    };
    if (match.key) obj.key = match.key.id;
    if (match.idx > -1) obj.refIndex = match.idx;
    matches.push(obj);
  });
  return matches;
}
function format(results, docs, { includeMatches = Config.includeMatches, includeScore = Config.includeScore } = {}) {
  return results.map((result) => {
    const { idx } = result;
    const data = {
      item: docs[idx],
      refIndex: idx
    };
    if (includeMatches) data.matches = formatMatches(result);
    if (includeScore) data.score = result.score;
    return data;
  });
}
var DEFAULT_TOKEN = /[\p{L}\p{M}\p{N}_]+/gu;
var warned = /* @__PURE__ */ new WeakSet();
function warnNonGlobal(regex) {
  if (!warned.has(regex)) {
    warned.add(regex);
    console.warn(`[Fuse] tokenize regex ${regex} lacks the global flag; only the first match per text will be returned. Add the 'g' flag.`);
  }
}
function resolveTokenize(tokenize2) {
  if (typeof tokenize2 === "function") {
    let validated = false;
    return (text) => {
      const result = tokenize2(text);
      if (!validated) {
        validated = true;
        if (!Array.isArray(result) || result.some((t) => typeof t !== "string")) throw new Error(`[Fuse] tokenize function must return string[]; received ${Array.isArray(result) ? "array containing non-strings" : typeof result}.`);
      }
      return result;
    };
  }
  if (tokenize2 instanceof RegExp) {
    if (!tokenize2.global) warnNonGlobal(tokenize2);
    return (text) => text.match(tokenize2) || [];
  }
  return (text) => text.match(DEFAULT_TOKEN) || [];
}
function createAnalyzer({ isCaseSensitive = false, ignoreDiacritics = false, tokenize: tokenize2 } = {}) {
  const tokenizeFn = resolveTokenize(tokenize2);
  return { tokenize(text) {
    if (!isCaseSensitive) text = text.toLowerCase();
    if (ignoreDiacritics) text = stripDiacritics(text);
    return tokenizeFn(text);
  } };
}
var TokenSearch = class {
  static condition(_, options) {
    return options.useTokenSearch;
  }
  constructor(pattern, options) {
    this.options = options;
    this.analyzer = createAnalyzer({
      isCaseSensitive: options.isCaseSensitive,
      ignoreDiacritics: options.ignoreDiacritics,
      tokenize: options.tokenize
    });
    const queryTerms = this.analyzer.tokenize(pattern);
    const { df, fieldCount } = options._invertedIndex;
    this.termSearchers = [];
    this.idfWeights = [];
    for (const term of queryTerms) {
      this.termSearchers.push(new BitapSearch(term, {
        location: options.location,
        threshold: options.threshold,
        distance: options.distance,
        includeMatches: options.includeMatches,
        findAllMatches: options.findAllMatches,
        minMatchCharLength: options.minMatchCharLength,
        isCaseSensitive: options.isCaseSensitive,
        ignoreDiacritics: options.ignoreDiacritics,
        ignoreLocation: true
      }));
      const docFreq = df.get(term) || 0;
      const idf = Math.log(1 + (fieldCount - docFreq + 0.5) / (docFreq + 0.5));
      this.idfWeights.push(idf);
    }
    this.combineAll = options.tokenMatch === "all";
    this.numTerms = this.termSearchers.length;
    this.useMask = this.numTerms <= 31;
  }
  searchIn(text) {
    if (!this.termSearchers.length) return {
      isMatch: false,
      score: 1
    };
    const allIndices = [];
    let weightedScore = 0;
    let maxPossibleScore = 0;
    let matchedCount = 0;
    let matchedMask = 0;
    const matchedTerms = this.combineAll && !this.useMask ? /* @__PURE__ */ new Set() : null;
    for (let i = 0; i < this.termSearchers.length; i++) {
      const result = this.termSearchers[i].searchIn(text);
      const idf = this.idfWeights[i];
      maxPossibleScore += idf;
      if (result.isMatch) {
        matchedCount++;
        weightedScore += idf * (1 - result.score);
        if (result.indices) allIndices.push(...result.indices);
        if (this.combineAll) if (this.useMask) matchedMask |= 1 << i;
        else matchedTerms.add(i);
      }
    }
    if (matchedCount === 0) return {
      isMatch: false,
      score: 1
    };
    const normalized = maxPossibleScore > 0 ? 1 - weightedScore / maxPossibleScore : 0;
    const searchResult = {
      isMatch: true,
      score: Math.max(1e-3, normalized)
    };
    if (this.options.includeMatches && allIndices.length) searchResult.indices = mergeIndices(allIndices);
    if (this.combineAll) {
      if (this.useMask) searchResult.matchedMask = matchedMask;
      else searchResult.matchedTerms = matchedTerms;
      searchResult.termCount = this.numTerms;
    }
    return searchResult;
  }
};
function addField(index, text, docIdx, analyzer) {
  const tokens = analyzer.tokenize(text);
  if (!tokens.length) return;
  index.fieldCount++;
  index.docFieldCount.set(docIdx, (index.docFieldCount.get(docIdx) || 0) + 1);
  const distinctTerms = new Set(tokens);
  let perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) {
    perDocTerms = /* @__PURE__ */ new Map();
    index.docTermFieldHits.set(docIdx, perDocTerms);
  }
  for (const term of distinctTerms) {
    perDocTerms.set(term, (perDocTerms.get(term) || 0) + 1);
    index.df.set(term, (index.df.get(term) || 0) + 1);
  }
}
function ingestRecord(index, record, keyCount, analyzer) {
  const { i: docIdx, v, $: fields } = record;
  if (v !== void 0) {
    addField(index, v, docIdx, analyzer);
    return;
  }
  if (!fields) return;
  for (let keyIdx = 0; keyIdx < keyCount; keyIdx++) {
    const value = fields[keyIdx];
    if (!value) continue;
    if (Array.isArray(value)) for (const sub of value) addField(index, sub.v, docIdx, analyzer);
    else addField(index, value.v, docIdx, analyzer);
  }
}
function buildInvertedIndex(records, keyCount, analyzer) {
  const index = {
    fieldCount: 0,
    df: /* @__PURE__ */ new Map(),
    docFieldCount: /* @__PURE__ */ new Map(),
    docTermFieldHits: /* @__PURE__ */ new Map()
  };
  for (const record of records) ingestRecord(index, record, keyCount, analyzer);
  return index;
}
function addToInvertedIndex(index, record, keyCount, analyzer) {
  ingestRecord(index, record, keyCount, analyzer);
}
function removeFromInvertedIndex(index, docIdx) {
  const fieldCount = index.docFieldCount.get(docIdx);
  if (fieldCount === void 0) return;
  index.fieldCount -= fieldCount;
  index.docFieldCount.delete(docIdx);
  const perDocTerms = index.docTermFieldHits.get(docIdx);
  if (!perDocTerms) return;
  for (const [term, hits] of perDocTerms) {
    const next = (index.df.get(term) || 0) - hits;
    if (next <= 0) index.df.delete(term);
    else index.df.set(term, next);
  }
  index.docTermFieldHits.delete(docIdx);
}
function removeAndShiftInvertedIndex(index, removedIndices) {
  if (removedIndices.length === 0) return;
  const sorted = Array.from(new Set(removedIndices)).sort((a, b) => a - b);
  for (const idx of sorted) removeFromInvertedIndex(index, idx);
  const shift = (oldIdx) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (sorted[mid] < oldIdx) lo = mid + 1;
      else hi = mid;
    }
    return oldIdx - lo;
  };
  const firstRemoved = sorted[0];
  const shiftedDocFieldCount = /* @__PURE__ */ new Map();
  for (const [oldKey, count] of index.docFieldCount) shiftedDocFieldCount.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, count);
  index.docFieldCount = shiftedDocFieldCount;
  const shiftedDocTermFieldHits = /* @__PURE__ */ new Map();
  for (const [oldKey, terms] of index.docTermFieldHits) shiftedDocTermFieldHits.set(oldKey > firstRemoved ? shift(oldKey) : oldKey, terms);
  index.docTermFieldHits = shiftedDocTermFieldHits;
}
var Fuse = class {
  constructor(docs, options, index) {
    this.options = {
      ...Config,
      ...options
    };
    if (this.options.useExtendedSearch && false) ;
    if (this.options.useTokenSearch && false) ;
    this._keyStore = new KeyStore(this.options.keys);
    this._docs = docs;
    this._myIndex = null;
    this._invertedIndex = null;
    this.setCollection(docs, index);
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  _getSearcher(query) {
    if (this._lastQuery === query) return this._lastSearcher;
    const searcher = createSearcher(query, this._invertedIndex ? {
      ...this.options,
      _invertedIndex: this._invertedIndex
    } : this.options);
    this._lastQuery = query;
    this._lastSearcher = searcher;
    return searcher;
  }
  setCollection(docs, index) {
    this._docs = docs;
    if (index && !(index instanceof FuseIndex)) throw new Error(INCORRECT_INDEX_TYPE);
    this._myIndex = index || createIndex(this.options.keys, this._docs, {
      getFn: this.options.getFn,
      fieldNormWeight: this.options.fieldNormWeight
    });
    if (this.options.useTokenSearch) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      this._invertedIndex = buildInvertedIndex(this._myIndex.records, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  add(doc) {
    if (!isDefined(doc)) return;
    this._docs.push(doc);
    const record = this._myIndex.add(doc, this._docs.length - 1);
    if (this._invertedIndex && record) {
      const analyzer = createAnalyzer({
        isCaseSensitive: this.options.isCaseSensitive,
        ignoreDiacritics: this.options.ignoreDiacritics,
        tokenize: this.options.tokenize
      });
      addToInvertedIndex(this._invertedIndex, record, this._myIndex.keys.length, analyzer);
    }
    this._invalidateSearcherCache();
  }
  remove(predicate = () => false) {
    const results = [];
    const indicesToRemove = [];
    for (let i = 0, len = this._docs.length; i < len; i += 1) if (predicate(this._docs[i], i)) {
      results.push(this._docs[i]);
      indicesToRemove.push(i);
    }
    if (indicesToRemove.length) {
      if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, indicesToRemove);
      const toRemove = new Set(indicesToRemove);
      this._docs = this._docs.filter((_, i) => !toRemove.has(i));
      this._myIndex.removeAll(indicesToRemove);
      this._invalidateSearcherCache();
    }
    return results;
  }
  removeAt(idx) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= this._docs.length) throw new Error(INVALID_DOC_INDEX);
    if (this._invertedIndex) removeAndShiftInvertedIndex(this._invertedIndex, [idx]);
    const doc = this._docs.splice(idx, 1)[0];
    this._myIndex.removeAt(idx);
    this._invalidateSearcherCache();
    return doc;
  }
  _invalidateSearcherCache() {
    this._lastQuery = null;
    this._lastSearcher = null;
  }
  getIndex() {
    return this._myIndex;
  }
  search(query, options) {
    const { limit = -1 } = options || {};
    const { includeMatches, includeScore, shouldSort, sortFn, ignoreFieldNorm } = this.options;
    if (isString(query) && !query.trim()) {
      let docs = this._docs.map((item, idx) => ({
        item,
        refIndex: idx
      }));
      if (isNumber(limit) && limit > -1) docs = docs.slice(0, limit);
      return docs;
    }
    const useHeap = isNumber(limit) && limit > 0 && isString(query);
    let results;
    if (useHeap) {
      const heap = new MaxHeap(limit);
      if (isString(this._docs[0])) this._searchStringList(query, {
        heap,
        ignoreFieldNorm
      });
      else this._searchObjectList(query, {
        heap,
        ignoreFieldNorm
      });
      results = heap.extractSorted(sortFn);
    } else {
      results = isString(query) ? isString(this._docs[0]) ? this._searchStringList(query) : this._searchObjectList(query) : this._searchLogical(query);
      computeScore(results, { ignoreFieldNorm });
      if (shouldSort) results.sort(sortFn);
      if (isNumber(limit) && limit > -1) results = results.slice(0, limit);
    }
    return format(results, this._docs, {
      includeMatches,
      includeScore
    });
  }
  _searchStringList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { records } = this._myIndex;
    const results = heap ? null : [];
    records.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          value: text,
          norm: norm2,
          indices: searchResult.indices
        };
        if (requireAllTokens) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        const matches = [match];
        if (!requireAllTokens || this._coversAllTokens(matches)) {
          const result = {
            item: text,
            idx,
            matches
          };
          if (heap) {
            result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
            if (heap.shouldInsert(result.score)) heap.insert(result);
          } else results.push(result);
        }
      }
    });
    return results;
  }
  _searchLogical(query) {
    const expression = parse(query, this.options);
    const evaluate = (node, item, idx) => {
      if (!("children" in node)) {
        const { keyId, searcher } = node;
        let matches;
        if (keyId === null) {
          matches = [];
          this._myIndex.keys.forEach((key, keyIndex) => {
            matches.push(...this._findMatches({
              key,
              value: item[keyIndex],
              searcher
            }));
          });
        } else matches = this._findMatches({
          key: this._keyStore.get(keyId),
          value: this._myIndex.getValueForItemAtKeyId(item, keyId),
          searcher
        });
        if (matches && matches.length) return [{
          idx,
          item,
          matches
        }];
        return [];
      }
      const { children: children2, operator } = node;
      const res = [];
      for (let i = 0, len = children2.length; i < len; i += 1) {
        const child = children2[i];
        const result = evaluate(child, item, idx);
        if (result.length) res.push(...result);
        else if (operator === LogicalOperator.AND) return [];
      }
      return res;
    };
    const records = this._myIndex.records;
    const resultMap = /* @__PURE__ */ new Map();
    const results = [];
    records.forEach(({ $: item, i: idx }) => {
      if (isDefined(item)) {
        const expResults = evaluate(expression, item, idx);
        if (expResults.length) {
          if (!resultMap.has(idx)) {
            resultMap.set(idx, {
              idx,
              item,
              matches: []
            });
            results.push(resultMap.get(idx));
          }
          expResults.forEach(({ matches }) => {
            resultMap.get(idx).matches.push(...matches);
          });
        }
      }
    });
    return results;
  }
  _searchObjectList(query, { heap, ignoreFieldNorm } = {}) {
    const searcher = this._getSearcher(query);
    const requireAllTokens = this.options.useTokenSearch && this.options.tokenMatch === "all";
    const { keys, records } = this._myIndex;
    const results = heap ? null : [];
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item)) return;
      const matches = [];
      let anyKeyFailed = false;
      let hasInverse = false;
      keys.forEach((key, keyIndex) => {
        const keyMatches = this._findMatches({
          key,
          value: item[keyIndex],
          searcher
        });
        if (keyMatches.length) {
          matches.push(...keyMatches);
          if (keyMatches[0].hasInverse) hasInverse = true;
        } else anyKeyFailed = true;
      });
      if (hasInverse && anyKeyFailed) return;
      if (matches.length && (!requireAllTokens || this._coversAllTokens(matches))) {
        const result = {
          idx,
          item,
          matches
        };
        if (heap) {
          result.score = computeScoreSingle(result.matches, { ignoreFieldNorm });
          if (heap.shouldInsert(result.score)) heap.insert(result);
        } else results.push(result);
      }
    });
    return results;
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value)) return [];
    const matches = [];
    if (isArray(value)) value.forEach(({ v: text, i: idx, n: norm2 }) => {
      if (!isDefined(text)) return;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          idx,
          norm: norm2,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== void 0) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    });
    else {
      const { v: text, n: norm2 } = value;
      const searchResult = searcher.searchIn(text);
      if (searchResult.isMatch) {
        const match = {
          score: searchResult.score,
          key,
          value: text,
          norm: norm2,
          indices: searchResult.indices,
          hasInverse: searchResult.hasInverse
        };
        if (searchResult.termCount !== void 0) {
          match.matchedMask = searchResult.matchedMask;
          match.matchedTerms = searchResult.matchedTerms;
          match.termCount = searchResult.termCount;
        }
        matches.push(match);
      }
    }
    return matches;
  }
  _coversAllTokens(matches) {
    const termCount = matches.length ? matches[0].termCount : void 0;
    if (termCount === void 0) return true;
    if (termCount <= 31) {
      let coverage2 = 0;
      for (let i = 0; i < matches.length; i++) coverage2 |= matches[i].matchedMask || 0;
      return coverage2 === 2 ** termCount - 1;
    }
    const coverage = /* @__PURE__ */ new Set();
    for (let i = 0; i < matches.length; i++) {
      const terms = matches[i].matchedTerms;
      if (terms) for (const t of terms) coverage.add(t);
    }
    return coverage.size === termCount;
  }
};
Fuse.version = "7.4.2";
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;
Fuse.match = function(pattern, text, options) {
  if (options && options.useTokenSearch) throw new Error(FUSE_MATCH_TOKEN_SEARCH_UNSUPPORTED);
  return createSearcher(pattern, {
    ...Config,
    ...options
  }).searchIn(text);
};
Fuse.parseQuery = parse;
register(ExtendedSearch);
register(TokenSearch);
Fuse.use = function(...plugins) {
  plugins.forEach((plugin) => register(plugin));
};
var entry_default = Fuse;

// src/components/modals/KeyModal.tsx
var _tmpl$121 = /* @__PURE__ */ template(`<div class="gf-card mx-4 mt-3 flex flex-col gap-1 text-sm [--gf-accent:#d9542b]"><div class="border-b border-white/15 pb-1 leading-5 font-bold"></div><span class="text-xs text-[#C9C8CE]">`);
var _tmpl$231 = /* @__PURE__ */ template(`<div class="flex max-h-180 flex-row px-10"><div class="flex w-30 shrink-0 flex-col items-stretch justify-center bg-[#2A3D46] py-5"><div class="flex justify-center pb-2"><img loading=lazy class="h-15 w-15 rounded-full border-3 border-[#687177] bg-[#0D1C1C] object-cover"></div></div><div class="flex w-70 grow flex-col"><div class="flex grow overflow-y-auto p-5 px-4 pt-2"><div class="flex flex-row flex-wrap content-start items-start gap-3.5"></div></div><div class="flex shrink flex-row flex-wrap gap-1 p-2 pl-4"><div class="flex font-bold"></div><div></div></div><div class="flex p-2"><div class="flex grow justify-center p-2"><input class=input type=text placeholder=Filter...>`, true, false, false);
var _tmpl$325 = /* @__PURE__ */ template(`<img decoding=async width=64 height=64 class="h-16 w-16 object-cover">`);
var _tmpl$417 = /* @__PURE__ */ template(`<span class="gf-badge gf-badge-required absolute top-1 left-3 z-30">`);
var _tmpl$515 = /* @__PURE__ */ template(`<div><div class="relative h-15 w-15">`);
var _tmpl$613 = /* @__PURE__ */ template(`<span class="text-xs text-[#5FB672]">Equipped`);
var _tmpl$712 = /* @__PURE__ */ template(`<span class="text-xs text-[#C9C8CE]">Issue: `);
var _tmpl$812 = /* @__PURE__ */ template(`<div><div class="flex items-baseline gap-2 border-b border-white/15 pb-1 leading-5"><span class=font-bold>Need to equip `);
var _tmpl$910 = /* @__PURE__ */ template(`<span class="text-xs text-[#C9C8CE]">Confirm here, then confirm the equipment screen to apply it.`);
var _tmpl$06 = /* @__PURE__ */ template(`<div><span></span><span class=whitespace-pre-line>`);
var _tmpl$127 = /* @__PURE__ */ template(`<div class="flex items-start gap-1.5 text-xs text-[#C9C8CE]"><span class="gf-badge gf-badge-missing h-4 w-4 shrink-0"></span><span>`);
var _tmpl$1010 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 z-20 h-7 w-7 shadow-sm shadow-black/20">`);
var _tmpl$1110 = /* @__PURE__ */ template(`<div class="gf-badge gf-badge-recommended">`);
var _tmpl$128 = /* @__PURE__ */ template(`<div class="gf-badge gf-badge-missing">`);
var _tmpl$135 = /* @__PURE__ */ template(`<div class="gf-badge gf-badge-required">`);
var _tmpl$145 = /* @__PURE__ */ template(`<div class="pointer-events-none absolute top-9 right-1 z-20 rounded-sm bg-[#2A3D46] px-1 text-xs font-bold text-[#EFEFEF]">`);
var _tmpl$154 = /* @__PURE__ */ template(`<div class="absolute right-1 bottom-1 rounded-sm bg-[#2A3D46] px-1 text-xs font-bold text-[#EFEFEF]">`);
var _tmpl$164 = /* @__PURE__ */ template(`<div><div class="absolute top-1 left-1 z-20 flex flex-col gap-0.5"></div><div><img loading=lazy decoding=async width=88 height=88 class="h-22 w-22 object-cover">`, true, false, false);
var _tmpl$174 = /* @__PURE__ */ template(`<img decoding=async width=28 height=28 class="h-7 w-7 rounded-full border-2 border-white bg-[#C9C8CE] object-cover object-top">`);
var _tmpl$184 = /* @__PURE__ */ template(`<div class="absolute right-1 bottom-2 z-20 h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-[#C9C8CE]"><div class="relative -top-1 -left-2.5 w-12"><img loading=lazy decoding=async width=48 height=48 class="w-full object-cover object-top">`, true, false, false);
function dollNames(ids) {
  const names = ids.map((id) => getDollById(id).name);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
}
function KeyModal() {
  const currentDoll = selectedDoll();
  if (!currentDoll) return null;
  const dollInfo = createMemo(() => getSelectedDoll(currentDoll));
  const info = dollInfo();
  if (!info) return null;
  const [sortedKeys, setSortedKeys] = createStore(sortEquippedKeys(currentDoll));
  const selectedKeys = createMemo(() => getPreSortedKeyInfo(currentDoll, sortedKeys));
  const allKeys = Object.values(combinedKeys.data);
  const keyTypes = {
    [1 /* FixedKey */]: info.keys.filter((k) => k.type === 1 /* FixedKey */),
    [3 /* ExpansionKey */]: info.keys.filter((k) => k.type === 3 /* ExpansionKey */),
    [4 /* AffinityKey */]: allKeys.filter((k) => k.type === 4 /* AffinityKey */),
    [2 /* CommonKey */]: allKeys.filter((k) => k.type === 2 /* CommonKey */)
  };
  const need = keyFocus()?.dollId === currentDoll.id ? keyFocus() : null;
  onCleanup(() => setKeyFocus(null));
  const neededKey = need ? getKeyById(need.keyId) : void 0;
  const targetSlots = neededKey ? keyMapping.flatMap((type, slot) => type === neededKey.type && (type !== 3 /* ExpansionKey */ || hasExpansionKey(info)) ? [slot] : []) : [];
  const neededEquipped = () => !!neededKey && sortedKeys.includes(neededKey.id);
  const openingKeys = neededKey ? sortedKeys.filter((keyId) => keyId && getKeyById(keyId).type === neededKey.type) : [];
  const lockedKeys = createMemo(() => {
    if (!neededKey) return [];
    const current = [...sortedKeys];
    const candidates = /* @__PURE__ */ new Set([...openingKeys, ...current.filter((keyId) => keyId && getKeyById(keyId).type === neededKey.type)]);
    candidates.delete(neededKey.id);
    return [...candidates].flatMap((keyId) => {
      const keys = current.includes(keyId) ? current : [...current, keyId];
      const team = tempSelectedDolls.map((sd) => sd.id === currentDoll.id ? {
        ...unwrap(sd),
        keys
      } : unwrap(sd));
      const issues = keySwapImpact(team, currentDoll.id, keyId, "");
      return issues.length ? [{
        keyId,
        issues
      }] : [];
    });
  });
  const overLimitKeys = createMemo(() => currentDoll.borrow ? [] : sortedKeys.flatMap((keyId) => {
    if (!keyId) return [];
    const max = maxKeyHolders(getKeyById(keyId));
    const others = keyHolders(tempSelectedDolls, keyId).filter((id) => id !== currentDoll.id);
    return max !== void 0 && others.length >= max ? [{
      keyId,
      max,
      others
    }] : [];
  }));
  const overLimitTitle = () => {
    const overLimits = overLimitKeys();
    if (overLimits.some((overLimit) => overLimit.max > 1)) return "Not enough copies";
    const types = new Set(overLimits.map((overLimit) => getKeyById(overLimit.keyId).type));
    return types.size === 1 ? `${KeyTypeLabels[[...types][0]]} equipped on multiple dolls` : "Keys equipped on multiple dolls";
  };
  const copiesText = (keyId, max, others) => max === 1 ? `${keyName(keyId)} is already equipped on ${dollNames(others)}` : `All ${max} copies of ${keyName(keyId)} are already equipped (${dollNames(others)})`;
  const lockFor = (keyId) => lockedKeys().find((lock) => lock.keyId === keyId);
  const isSwappedOut = (keyId) => !sortedKeys.includes(keyId);
  const firstSafeSlot = targetSlots.find((slot) => !lockFor(sortedKeys[slot]));
  const swapText = (slot) => {
    if (!neededKey || !targetSlots.includes(slot)) return void 0;
    const current = sortedKeys[slot];
    const issues = lockFor(current)?.issues ?? [];
    if (neededEquipped()) {
      return current && issues.length ? `${keyName(current)} is locked, swapping it out would cause:
- ${issues.join("\n- ")}` : void 0;
    }
    const what = current ? `Swapping ${keyName(current)} for ${keyName(neededKey.id)}` : `Putting ${keyName(neededKey.id)} here`;
    return issues.length ? `${what} would cause:
- ${issues.join("\n- ")}` : `${what} causes no new issues`;
  };
  const [activeKeySlot, setActiveKeySlot] = createSignal(firstSafeSlot ?? targetSlots[0] ?? 0);
  const [keyTitle, setKeyTitle] = createSignal("");
  const [keyDescription, setKeyDescription] = createSignal("");
  const [slotSortedKeys, setSlotSortedKeys] = createSignal([...sortedKeys]);
  createEffect(on(activeKeySlot, () => setSlotSortedKeys([...sortedKeys]), {
    defer: true
  }));
  createEffect(() => {
    const selectedKey = selectedKeys()[activeKeySlot()];
    if (selectedKey) {
      setKeyTitle(selectedKey.name);
      setKeyDescription(parseEffects(selectedKey.description ?? ""));
    }
  });
  const [query, setQuery] = createSignal("");
  let filterInputRef;
  onMount(() => {
    const onKeyDown = (e) => {
      if (document.activeElement === filterInputRef) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1) return;
      if (document.activeElement instanceof HTMLButtonElement) return;
      filterInputRef?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      window.removeEventListener("keydown", onKeyDown);
    });
  });
  const visibleKeys = createMemo(() => {
    return keyTypes[keyMapping[activeKeySlot()]];
  });
  const filteredKeys = createMemo(() => {
    const isSel = (keyId) => {
      return slotSortedKeys().includes(keyId);
    };
    const fuse = new entry_default(visibleKeys(), {
      keys: ["dollName", "name"],
      includeScore: true
    });
    const results = fuse.search(query());
    const isNeeded = (keyId) => keyId === neededKey?.id;
    return results.sort((a, b) => {
      const dollAName = a.item.dollId ? getDollById(a.item.dollId).name : "";
      const dollBName = b.item.dollId ? getDollById(b.item.dollId).name : "";
      return +isNeeded(b.item.id) - +isNeeded(a.item.id) || +isSel(b.item.id) - +isSel(a.item.id) || (a.score ?? 0) - (b.score ?? 0) || (a.item.number ?? 0) - (b.item.number ?? 0) || dollAName.localeCompare(dollBName) || a.item.name.localeCompare(b.item.name);
    });
  });
  return (() => {
    var _el$ = _tmpl$231(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$4 = _el$3.firstChild, _el$5 = _el$2.nextSibling, _el$9 = _el$5.firstChild, _el$0 = _el$9.firstChild, _el$1 = _el$9.nextSibling, _el$10 = _el$1.firstChild, _el$11 = _el$10.nextSibling, _el$12 = _el$1.nextSibling, _el$13 = _el$12.firstChild, _el$14 = _el$13.firstChild;
    insert(_el$2, createComponent(For, {
      get each() {
        return selectedKeys();
      },
      children: (selectedKey, index) => {
        const doll = dollInfo();
        if (!hasExpansionKey(doll) && index() === 3) return null;
        const isSel = () => activeKeySlot() === index();
        const selectedStyle = "border-[#F26C1C] bg-linear-to-r from-[#5B403E] to-transparent scale-107";
        const unselectedStyle = "cursor-pointer transition-discrete duration-175 hover:scale-107 border-transparent hover:border-white bg-linear-to-r from-transparent hover:from-[#515B61] to-transparent";
        const dimmed = () => !!neededKey && !neededEquipped() && !targetSlots.includes(index());
        return (() => {
          var _el$15 = _tmpl$515(), _el$16 = _el$15.firstChild;
          _el$15.$$click = () => {
            setQuery("");
            setActiveKeySlot(index());
          };
          insert(_el$16, createComponent(Show, {
            when: selectedKey,
            get fallback() {
              return createComponent(EmptyKey, {
                get color() {
                  return isSel() ? "Light" : "Dark";
                }
              });
            },
            get children() {
              var _el$17 = _tmpl$325();
              createRenderEffect(() => setAttribute(_el$17, "src", selectedKey?.icon));
              return _el$17;
            }
          }), null);
          insert(_el$16, createComponent(Show, {
            get when() {
              return selectedKey?.unreleased;
            },
            get children() {
              return createComponent(UnreleasedBadge, {
                "class": "bottom-0 left-0 z-20 text-[10px]"
              });
            }
          }), null);
          insert(_el$15, createComponent(Show, {
            get when() {
              return lockFor(sortedKeys[index()]);
            },
            get children() {
              var _el$18 = _tmpl$417();
              insert(_el$18, createComponent(Lock, {}));
              return _el$18;
            }
          }), null);
          createRenderEffect((_p$) => {
            var _v$3 = swapText(index()), _v$4 = `relative flex justify-center border-l-4 py-2 ${isSel() ? selectedStyle : unselectedStyle} ${dimmed() ? "opacity-40" : ""}`;
            _v$3 !== _p$.e && setAttribute(_el$15, "title", _p$.e = _v$3);
            _v$4 !== _p$.t && className(_el$15, _p$.t = _v$4);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$15;
        })();
      }
    }), null);
    insert(_el$5, createComponent(Show, {
      when: neededKey,
      children: (key) => (() => {
        var _el$19 = _tmpl$812(), _el$20 = _el$19.firstChild, _el$21 = _el$20.firstChild, _el$22 = _el$21.firstChild;
        insert(_el$21, () => keyName(key().id), null);
        insert(_el$20, createComponent(Show, {
          get when() {
            return neededEquipped();
          },
          get children() {
            return _tmpl$613();
          }
        }), null);
        insert(_el$19, createComponent(Show, {
          get when() {
            return !neededEquipped();
          },
          get fallback() {
            return _tmpl$910();
          },
          get children() {
            var _el$24 = _tmpl$712(), _el$25 = _el$24.firstChild;
            insert(_el$24, () => need?.reason, null);
            return _el$24;
          }
        }), null);
        insert(_el$19, createComponent(For, {
          get each() {
            return lockedKeys();
          },
          children: (lock) => {
            const alert2 = () => isSwappedOut(lock.keyId) || sortedKeys.indexOf(lock.keyId) === activeKeySlot();
            return (() => {
              var _el$27 = _tmpl$06(), _el$28 = _el$27.firstChild, _el$29 = _el$28.nextSibling;
              insert(_el$28, createComponent(Lock, {}));
              insert(_el$29, (() => {
                var _c$ = memo(() => !!isSwappedOut(lock.keyId));
                return () => _c$() ? `${keyName(lock.keyId)} is locked, but was swapped out. This causes:` : `${keyName(lock.keyId)} is locked because swapping it out would cause:`;
              })(), null);
              insert(_el$29, () => `
- ${lock.issues.join("\n- ")}`, null);
              createRenderEffect((_p$) => {
                var _v$5 = `flex items-start gap-1.5 px-1.5 py-1 text-xs ${alert2() ? "bg-[#B83D2E] text-white" : "bg-[#2A3D46] text-[#C9C8CE]"}`, _v$6 = `gf-badge gf-badge-required h-4 w-4 shrink-0 ${alert2() ? "bg-black/25" : ""}`;
                _v$5 !== _p$.e && className(_el$27, _p$.e = _v$5);
                _v$6 !== _p$.t && className(_el$28, _p$.t = _v$6);
                return _p$;
              }, {
                e: void 0,
                t: void 0
              });
              return _el$27;
            })();
          }
        }), null);
        createRenderEffect(() => className(_el$19, `gf-card mx-4 mt-3 flex flex-col gap-1 text-sm ${neededEquipped() ? "[--gf-accent:#3D7A4A]" : ""}`));
        return _el$19;
      })()
    }), _el$9);
    insert(_el$5, createComponent(Show, {
      get when() {
        return overLimitKeys().length > 0;
      },
      get children() {
        var _el$6 = _tmpl$121(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling;
        insert(_el$7, overLimitTitle);
        insert(_el$6, createComponent(For, {
          get each() {
            return overLimitKeys();
          },
          children: (overLimit) => (() => {
            var _el$30 = _tmpl$127(), _el$31 = _el$30.firstChild, _el$32 = _el$31.nextSibling;
            insert(_el$31, createComponent(Alert, {}));
            insert(_el$32, () => `${copiesText(overLimit.keyId, overLimit.max, overLimit.others)}.`);
            return _el$30;
          })()
        }), _el$8);
        insert(_el$8, () => `Did you mean to mark ${dollNames([currentDoll.id])} as a borrow?`);
        return _el$6;
      }
    }), _el$9);
    insert(_el$0, createComponent(For, {
      get each() {
        return visibleKeys();
      },
      children: (key) => {
        const isNeeded = key.id === neededKey?.id;
        const lock = () => lockFor(key.id);
        const isSel = () => {
          if (sortedKeys.includes(key.id)) {
            if (sortedKeys[activeKeySlot()] === key.id) {
              return true;
            } else {
              return null;
            }
          }
          return false;
        };
        const toggleKey = () => {
          const index2 = sortedKeys.indexOf(key.id);
          if (index2 > -1) {
            setSortedKeys(index2, "");
          } else {
            setSortedKeys(activeKeySlot(), key.id);
          }
        };
        const [isVisible2, setIsVisible] = createSignal(false);
        const index = createMemo(() => {
          let index2 = filteredKeys().findIndex((filteredKey) => key.id === filteredKey.item.id);
          if (index2 < 0 && (slotSortedKeys().includes(key.id) || isNeeded)) {
            index2 = 0;
          }
          setIsVisible(index2 > -1);
          return index2 > -1 ? index2 : 9999;
        });
        const keyDollIcon = getDollAvatarByKey(key);
        const max = maxKeyHolders(key);
        const others = () => keyHolders(tempSelectedDolls, key.id).filter((id) => id !== currentDoll.id);
        const unavailable = () => max !== void 0 && !currentDoll.borrow && !sortedKeys.includes(key.id) && others().length >= max;
        const holderCount = () => others().length + (sortedKeys.includes(key.id) ? 1 : 0);
        const overLimit = () => max !== void 0 && !currentDoll.borrow && others().length >= max;
        return (() => {
          var _el$33 = _tmpl$164(), _el$35 = _el$33.firstChild, _el$40 = _el$35.nextSibling, _el$41 = _el$40.firstChild;
          _el$33.$$pointerover = () => {
            setKeyTitle(key.name);
            setKeyDescription(parseEffects(key.description));
          };
          _el$33.$$click = toggleKey;
          insert(_el$33, createComponent(Show, {
            get when() {
              return isSel() !== false;
            },
            get children() {
              var _el$34 = _tmpl$1010();
              insert(_el$34, createComponent(Check, {}));
              return _el$34;
            }
          }), _el$35);
          insert(_el$35, createComponent(Show, {
            get when() {
              return isNeeded && !neededEquipped();
            },
            get children() {
              var _el$36 = _tmpl$1110();
              insert(_el$36, createComponent(ThumbsUp, {}));
              return _el$36;
            }
          }), null);
          insert(_el$35, createComponent(Show, {
            get when() {
              return memo(() => !!overLimit())() && sortedKeys.includes(key.id);
            },
            get children() {
              var _el$37 = _tmpl$128();
              insert(_el$37, createComponent(Alert, {}));
              return _el$37;
            }
          }), null);
          insert(_el$35, createComponent(Show, {
            get when() {
              return lock();
            },
            get children() {
              var _el$38 = _tmpl$135();
              insert(_el$38, createComponent(Lock, {}));
              return _el$38;
            }
          }), null);
          insert(_el$35, createComponent(Show, {
            get when() {
              return others()[0];
            },
            children: (holder) => (() => {
              var _el$43 = _tmpl$174();
              createRenderEffect(() => setAttribute(_el$43, "src", getDollById(holder()).icons.avatar));
              return _el$43;
            })()
          }), null);
          insert(_el$33, createComponent(Show, {
            when: max !== void 0 && max > 1,
            get children() {
              var _el$39 = _tmpl$145();
              insert(_el$39, () => `${holderCount()}/${max} equipped`);
              return _el$39;
            }
          }), _el$40);
          insert(_el$40, createComponent(Show, {
            get when() {
              return key.unreleased;
            },
            get children() {
              return createComponent(UnreleasedBadge, {});
            }
          }), null);
          insert(_el$40, createComponent(Show, {
            get when() {
              return key.number !== null;
            },
            get children() {
              var _el$42 = _tmpl$154();
              insert(_el$42, () => key.number);
              return _el$42;
            }
          }), null);
          insert(_el$40, keyDollIcon && (() => {
            var _el$44 = _tmpl$184(), _el$45 = _el$44.firstChild, _el$46 = _el$45.firstChild;
            setAttribute(_el$46, "src", keyDollIcon);
            return _el$44;
          })(), null);
          createRenderEffect((_p$) => {
            var _v$7 = isNeeded ? need?.reason : lock() ? `Locked, swapping it out would cause:
- ${lock()?.issues.join("\n- ")}` : overLimit() && max !== void 0 ? `${copiesText(key.id, max, others())}. ${sortedKeys.includes(key.id) ? "Confirming shows this as an issue." : "Equipping it here shows as an issue."}` : others().length ? `Equipped on ${dollNames(others())}` : void 0, _v$8 = `${interactiveStyles(isSel())} inset-shadow-2xl relative flex flex-col rounded-sm border-3 border-[#B2B1B6] bg-[#95999B] shadow-black/75 ${isVisible2() ? "" : "hidden"} ${unavailable() ? "opacity-40" : ""}`, _v$9 = index(), _v$0 = `${rarityBorderColor(key.rarity)} relative border-b-5`, _v$1 = key.icon;
            _v$7 !== _p$.e && setAttribute(_el$33, "title", _p$.e = _v$7);
            _v$8 !== _p$.t && className(_el$33, _p$.t = _v$8);
            _v$9 !== _p$.a && setStyleProperty(_el$33, "order", _p$.a = _v$9);
            _v$0 !== _p$.o && className(_el$40, _p$.o = _v$0);
            _v$1 !== _p$.i && setAttribute(_el$41, "src", _p$.i = _v$1);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0
          });
          return _el$33;
        })();
      }
    }));
    insert(_el$10, keyTitle);
    _el$11.$$click = (e) => {
      const target = e.target.closest("[data-effect-id]");
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const popupWidth = 360;
      const popupHeight = 384;
      const margin = 8;
      const x = Math.max(margin, Math.min(rect.left, window.innerWidth - popupWidth - margin));
      const y = Math.max(margin, Math.min(rect.bottom + 4, window.innerHeight - popupHeight - margin));
      setEffectModalPosition({
        x,
        y
      });
      const effectId = target.dataset.effectId;
      if (effectId) {
        setEffectModalEffects(getReferencedEffects(effectId));
      }
      setShowEffectModal(true);
    };
    _el$14.$$input = (e) => setQuery(e.target.value);
    var _ref$ = filterInputRef;
    typeof _ref$ === "function" ? use(_ref$, _el$14) : filterInputRef = _el$14;
    insert(_el$12, createComponent(Button, {
      onClick: () => {
        const doll = selectedDoll();
        if (doll) {
          setDollKeys(doll.id, sortedKeys);
        }
        setShowKeyModal(false);
      },
      color: "light",
      design: "confirm"
    }), null);
    createRenderEffect((_p$) => {
      var _v$ = dollInfo().icons.avatar, _v$2 = keyDescription();
      _v$ !== _p$.e && setAttribute(_el$4, "src", _p$.e = _v$);
      _v$2 !== _p$.t && (_el$11.innerHTML = _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    createRenderEffect(() => _el$14.value = query());
    return _el$;
  })();
}
delegateEvents(["click", "input", "pointerover"]);

// src/components/modals/EffectModal.tsx
var _tmpl$129 = /* @__PURE__ */ template(`<div class="fixed z-60 max-h-96 w-90 overflow-y-auto rounded-md border border-[#3A3A3A] bg-[#1B1B1B] p-3 text-[#D0D0D0] shadow-2xl"><div class="flex flex-col gap-3">`);
var _tmpl$233 = /* @__PURE__ */ template(`<div class="flex flex-col"><div class="mb-1.5 border-b border-[#3A3A3A] pb-1.5 font-bold text-[#4FA8E8]"></div><div>`);
function EffectModal() {
  let ref;
  const onOutsideClick = (e) => {
    if (ref && !ref.contains(e.target)) {
      setShowEffectModal(false);
    }
  };
  onMount(() => {
    const timeout = setTimeout(() => {
      window.addEventListener("click", onOutsideClick);
    }, 0);
    onCleanup(() => {
      clearTimeout(timeout);
      window.removeEventListener("click", onOutsideClick);
    });
  });
  return (() => {
    var _el$ = _tmpl$129(), _el$2 = _el$.firstChild;
    var _ref$ = ref;
    typeof _ref$ === "function" ? use(_ref$, _el$) : ref = _el$;
    insert(_el$2, createComponent(For, {
      get each() {
        return effectModalEffects();
      },
      children: (effect) => (() => {
        var _el$3 = _tmpl$233(), _el$4 = _el$3.firstChild, _el$5 = _el$4.nextSibling;
        insert(_el$4, () => effect.name);
        createRenderEffect(() => _el$5.innerHTML = formatEffectDescription(effect.description));
        return _el$3;
      })()
    }));
    createRenderEffect((_p$) => {
      var _v$ = `${effectModalPosition().y}px`, _v$2 = `${effectModalPosition().x}px`;
      _v$ !== _p$.e && setStyleProperty(_el$, "top", _p$.e = _v$);
      _v$2 !== _p$.t && setStyleProperty(_el$, "left", _p$.t = _v$2);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}

// src/components/modals/WeaponModal.tsx
var _tmpl$130 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="flex flex-row flex-wrap gap-4">`);
var _tmpl$234 = /* @__PURE__ */ template(`<div class="absolute bottom-1 left-2 z-20 h-12 w-12"><img loading=lazy decoding=async width=48 height=48 class="relative h-full w-full object-cover">`, true, false, false);
var _tmpl$326 = /* @__PURE__ */ template(`<div><div></div><img loading=lazy decoding=async width=194 height=97><div>`, true, false, false);
var _tmpl$418 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function sortWeapons(weaponA, weaponB) {
  return weaponB.rarity - weaponA.rarity || weaponA.name.localeCompare(weaponB.name);
}
function WeaponModal() {
  const sd = selectedDoll();
  if (!sd) return null;
  const doll = getSelectedDoll(sd);
  const weapon = isRenderable({
    kind: "dollWeapon" /* DollWeapon */,
    dollId: sd.id
  }) ? getWeaponById(sd.gun) : getWeaponByDollId(sd.id);
  const [selectedWeaponId, setSelectedWeaponId] = createSignal(weapon.id);
  const visibleWeapons = Object.values(combinedWeapons.data).filter((weapon2) => weapon2.gunType === doll.gunType).sort(sortWeapons);
  return [createComponent(ModalHeader, {
    title: "Select Weapon"
  }), (() => {
    var _el$ = _tmpl$130(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(For, {
      each: visibleWeapons,
      children: (weapon2) => {
        const chibiIcon = getDollChibiIconByWeapon(weapon2);
        const isSel = () => selectedWeaponId() === weapon2.id;
        return (() => {
          var _el$3 = _tmpl$326(), _el$6 = _el$3.firstChild, _el$7 = _el$6.nextSibling, _el$8 = _el$7.nextSibling;
          _el$3.$$click = () => setSelectedWeaponId(weapon2.id);
          insert(_el$3, (() => {
            var _c$ = memo(() => !!isSel());
            return () => _c$() && (() => {
              var _el$9 = _tmpl$418();
              insert(_el$9, createComponent(Check, {}));
              return _el$9;
            })();
          })(), _el$6);
          insert(_el$3, createComponent(Show, {
            when: chibiIcon,
            get children() {
              var _el$4 = _tmpl$234(), _el$5 = _el$4.firstChild;
              setAttribute(_el$5, "src", chibiIcon);
              return _el$4;
            }
          }), _el$6);
          className(_el$6, `absolute bottom-1 z-20 w-full text-right font-bold ${chibiIcon === "" ? "pl-2" : "pl-15"} overflow-hidden pr-2 text-ellipsis whitespace-nowrap`);
          insert(_el$6, () => weapon2.name);
          insert(_el$3, createComponent(Show, {
            get when() {
              return weapon2.unreleased;
            },
            get children() {
              return createComponent(UnreleasedBadge, {
                "class": "top-1 left-1 z-30 text-xs"
              });
            }
          }), _el$8);
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(isSel())} relative flex h-25.5 w-48.5 flex-col items-center justify-center overflow-hidden rounded-sm bg-[#354346] px-1.5 py-1 shadow-sm shadow-black/50`, _v$2 = weapon2.icon, _v$3 = `relative z-10 h-full w-full border-b-3 ${rarityBorderColor(weapon2.rarity)} object-cover`, _v$4 = `absolute bottom-0 left-0 z-0 h-full w-full bg-linear-to-t ${rarityGradientColor(weapon2.rarity)} from-0% to-transparent to-75%`;
            _v$ !== _p$.e && className(_el$3, _p$.e = _v$);
            _v$2 !== _p$.t && setAttribute(_el$7, "src", _p$.t = _v$2);
            _v$3 !== _p$.a && className(_el$7, _p$.a = _v$3);
            _v$4 !== _p$.o && className(_el$8, _p$.o = _v$4);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0
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
          const doll2 = selectedDoll();
          if (doll2) {
            setDollWeapon(doll2.id, selectedWeaponId());
          }
        },
        color: "dark",
        design: "confirm"
      })];
    }
  })];
}
delegateEvents(["click"]);

// src/components/modals/DarkModal.tsx
var _tmpl$131 = /* @__PURE__ */ template(`<div>`);
function DarkModal(props) {
  const resolved = children(() => props.children);
  return (() => {
    var _el$ = _tmpl$131();
    insert(_el$, resolved);
    createRenderEffect(() => className(_el$, `${props.width ?? "w-225"} ${props.hide ? "hidden" : ""} flex flex-col overflow-hidden rounded-sm border-t-4 border-[#3E5356] bg-[#2C373B] shadow-2xl`));
    return _el$;
  })();
}

// src/components/modals/BuffModal.tsx
var _tmpl$136 = /* @__PURE__ */ template(`<div class="h-100 overflow-y-scroll p-2 px-4"><div class="flex flex-row flex-wrap gap-4">`);
var _tmpl$235 = /* @__PURE__ */ template(`<div class="text-md mx-3 mt-1.75 flex h-10 items-center justify-center self-stretch bg-[#384B53] font-bold tracking-wide text-[#ECECEC]">Select one or more buffs relevant to this transcript`);
var _tmpl$327 = /* @__PURE__ */ template(`<div><div><img class="relative z-20 h-full w-full object-cover"></div><div class="flex grow flex-col gap-3 text-[#384B53]"><div class="flex grow flex-row gap-3 border-b-2 border-[#E0DDE7]"><div class="text-left font-bold text-black"></div><div class=text-left></div></div><div class=text-left>`);
var _tmpl$419 = /* @__PURE__ */ template(`<div class="absolute top-1 right-1 h-7 w-7 shadow-sm shadow-black/20">`);
function BuffModal() {
  const [selectedBuffs, setSelectedBuffs] = createSignal([...state.buffs]);
  const season = getCurrentSeason();
  const buffIds = Object.keys(season.dailyBuffIds);
  buffIds.push(season.buffId);
  const sortedBuffs = buffIds.sort(sortBuffs);
  return [createComponent(ModalHeader, {
    title: "Select Seasonal Buffs"
  }), (() => {
    var _el$ = _tmpl$136(), _el$2 = _el$.firstChild;
    insert(_el$2, createComponent(For, {
      each: sortedBuffs,
      children: (buff) => {
        const isSel = () => selectedBuffs().includes(buff);
        const isCore = buff === season.buffId;
        const info = getBuffById(buff);
        const toggleBuff = () => setSelectedBuffs((buffs) => selectedBuffs().includes(buff) ? selectedBuffs().filter((b) => b !== buff) : [...buffs, buff]);
        const days = () => {
          if (buff === season.buffId) {
            return "Effective this season";
          }
          if (season.dailyBuffIds[buff]) {
            return "Available on days " + season.dailyBuffIds[buff].join(", ");
          }
          return "Unavailable this gunsmoke season";
        };
        return (() => {
          var _el$4 = _tmpl$327(), _el$5 = _el$4.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$5.nextSibling, _el$8 = _el$7.firstChild, _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling, _el$1 = _el$8.nextSibling;
          _el$4.$$click = () => toggleBuff();
          insert(_el$4, (() => {
            var _c$ = memo(() => !!isSel());
            return () => _c$() && (() => {
              var _el$10 = _tmpl$419();
              insert(_el$10, createComponent(Check, {}));
              return _el$10;
            })();
          })(), _el$5);
          className(_el$5, `relative flex h-15 w-15 shrink-0 ${isCore ? "bg-[#0D76A1]" : "bg-[#2D464E]"} rounded-sm`);
          insert(_el$9, () => info.name);
          insert(_el$0, days);
          insert(_el$1, createComponent(Buffs, {
            id: buff
          }));
          createRenderEffect((_p$) => {
            var _v$ = `${interactiveStyles(isSel())} relative flex grow flex-row items-start gap-3 rounded-sm bg-[#F2EEF8] p-2.5 shadow-sm shadow-black/20 hover:scale-100!`, _v$2 = info.icon;
            _v$ !== _p$.e && className(_el$4, _p$.e = _v$);
            _v$2 !== _p$.t && setAttribute(_el$6, "src", _p$.t = _v$2);
            return _p$;
          }, {
            e: void 0,
            t: void 0
          });
          return _el$4;
        })();
      }
    }));
    return _el$;
  })(), _tmpl$235(), createComponent(ModalFooter, {
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

// src/components/modals/ErrorModal.tsx
var _tmpl$137 = /* @__PURE__ */ template(`<div class="flex flex-col gap-3"><div class="text-md mx-3 flex flex-col items-center justify-center gap-1 self-stretch bg-[#AE4749] p-2 text-center font-bold tracking-wide text-[#ECECEC]"></div><div class="mx-3 text-center text-[#384B53]">Please copy the details below and send them to ArkahnX so this can be fixed.</div><textarea readonly class="mx-3 h-48 resize-none items-center justify-center self-stretch rounded-md bg-zinc-950 p-2 font-mono text-xs">`);
var _tmpl$236 = /* @__PURE__ */ template(`<span>`);
function ErrorModal() {
  const [copied, setCopied] = createSignal(false);
  const details = () => importErrors().map((report) => report.details).join("\n\n----------\n\n");
  const handleCopy = async () => {
    await navigator.clipboard.writeText(details());
    setCopied(true);
    setTimeout(() => setCopied(false), 2e3);
  };
  return [createComponent(ModalHeader, {
    title: "Something went wrong"
  }), (() => {
    var _el$ = _tmpl$137(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling;
    insert(_el$2, createComponent(For, {
      get each() {
        return importErrors();
      },
      children: (report) => (() => {
        var _el$5 = _tmpl$236();
        insert(_el$5, () => report.message);
        return _el$5;
      })()
    }));
    _el$4.addEventListener("focus", (e) => {
      e.currentTarget.select();
    });
    createRenderEffect(() => _el$4.value = details());
    return _el$;
  })(), createComponent(ModalFooter, {
    styles: "justify-between",
    get children() {
      return [createComponent(Button, {
        onClick: () => setImportErrors([]),
        color: "dark",
        design: "cancel",
        content: "Close"
      }), createComponent(Button, {
        onClick: () => void handleCopy(),
        color: "dark",
        design: "confirm",
        get content() {
          return copied() ? "Copied!" : "Copy Details";
        }
      })];
    }
  })];
}

// src/App.tsx
var _tmpl$138 = /* @__PURE__ */ template(`<div class="flex h-screen flex-col bg-zinc-950 text-white"><div class="relative flex-1 overflow-hidden"id=body>`);
function App() {
  const init = async () => {
    await loadGameData();
    loadSlots();
    migrate();
    loadLocalState();
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get("state");
    const stateIdParam = params.get("stateId");
    if (stateParam !== null) {
      setStateFromURL(true);
      await importState(loadFromString, stateParam);
    } else if (stateIdParam !== null) {
      setStateFromURL(true);
      await importState(loadFromWorker, stateIdParam);
    } else {
      await importState(loadFromLocalStorage, "");
    }
    setTimeout(() => setLoaded(true), 0);
    prefetchModalImages();
  };
  const updateStateHashMatch = () => {
    setStateHashMatch(compareStateHash());
  };
  onMount(() => {
    void init();
    window.addEventListener("focus", updateStateHashMatch);
  });
  onCleanup(() => {
    window.removeEventListener("focus", updateStateHashMatch);
  });
  createEffect(() => {
    if (!loaded()) return;
    trackStore(state);
    setTimeout(updateStateHashMatch, 0);
  });
  createEffect(() => {
    if (!loaded()) return;
    trackStore(localState);
    saveLocalState();
  });
  const isEditorTab = () => localState.currentTab === -1;
  const isArenaTab = () => localState.currentTab >= 0 && localState.currentTab <= 7;
  const isSummaryTab = () => localState.currentTab === 8;
  const handleTabChange = (tab) => {
    if (tab === -1) {
      setTimeout(() => {
        editorRender();
      }, 0);
    }
  };
  return (() => {
    var _el$ = _tmpl$138(), _el$2 = _el$.firstChild;
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
        return memo(() => !!showIssuesModal())() && loaded();
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              width: "w-180",
              get children() {
                return createComponent(IssuesModal, {});
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
    insert(_el$, createComponent(Show, {
      get when() {
        return memo(() => !!showEffectModal())() && loaded();
      },
      get children() {
        return createComponent(EffectModal, {});
      }
    }), null);
    insert(_el$, createComponent(Show, {
      get when() {
        return importErrors().length;
      },
      get children() {
        return createComponent(FullScreen, {
          get children() {
            return createComponent(Modal, {
              width: "w-140",
              get children() {
                return createComponent(ErrorModal, {});
              }
            });
          }
        });
      }
    }), null);
    return _el$;
  })();
}

// src/index.tsx
var root = document.getElementById("root");
if (!root) throw new Error("No #root element found");
render(() => createComponent(App, {}), root);
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  new EventSource("/esbuild").addEventListener("change", () => {
    location.reload();
  });
}
//# sourceMappingURL=index.js.map
