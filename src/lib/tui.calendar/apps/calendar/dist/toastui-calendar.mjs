var iu = Object.defineProperty, su = Object.defineProperties;
var au = Object.getOwnPropertyDescriptors;
var Wn = Object.getOwnPropertySymbols;
var ms = Object.prototype.hasOwnProperty, gs = Object.prototype.propertyIsEnumerable;
var hs = (e, t, n) => t in e ? iu(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n, R = (e, t) => {
  for (var n in t || (t = {}))
    ms.call(t, n) && hs(e, n, t[n]);
  if (Wn)
    for (var n of Wn(t))
      gs.call(t, n) && hs(e, n, t[n]);
  return e;
}, ae = (e, t) => su(e, au(t));
var Yn = (e, t) => {
  var n = {};
  for (var r in e)
    ms.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
  if (e != null && Wn)
    for (var r of Wn(e))
      t.indexOf(r) < 0 && gs.call(e, r) && (n[r] = e[r]);
  return n;
};
import cu from "tui-date-picker";
var On, P, Ua, Sn, vs, za, ur = {}, Wa = [], lu = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i;
function tt(e, t) {
  for (var n in t) e[n] = t[n];
  return e;
}
function Ya(e) {
  var t = e.parentNode;
  t && t.removeChild(e);
}
function pt(e, t, n) {
  var r, o, i, s = {};
  for (i in t) i == "key" ? r = t[i] : i == "ref" ? o = t[i] : s[i] = t[i];
  if (arguments.length > 2 && (s.children = arguments.length > 3 ? On.call(arguments, 2) : n), typeof e == "function" && e.defaultProps != null) for (i in e.defaultProps) s[i] === void 0 && (s[i] = e.defaultProps[i]);
  return Tn(e, s, r, o, null);
}
function Tn(e, t, n, r, o) {
  var i = { type: e, props: t, key: n, ref: r, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: o == null ? ++Ua : o };
  return o == null && P.vnode != null && P.vnode(i), i;
}
function Me(e) {
  return e.children;
}
function nt(e, t) {
  this.props = e, this.context = t;
}
function jt(e, t) {
  if (t == null) return e.__ ? jt(e.__, e.__.__k.indexOf(e) + 1) : null;
  for (var n; t < e.__k.length; t++) if ((n = e.__k[t]) != null && n.__e != null) return n.__e;
  return typeof e.type == "function" ? jt(e) : null;
}
function Va(e) {
  var t, n;
  if ((e = e.__) != null && e.__c != null) {
    for (e.__e = e.__c.base = null, t = 0; t < e.__k.length; t++) if ((n = e.__k[t]) != null && n.__e != null) {
      e.__e = e.__c.base = n.__e;
      break;
    }
    return Va(e);
  }
}
function $o(e) {
  (!e.__d && (e.__d = !0) && Sn.push(e) && !dr.__r++ || vs !== P.debounceRendering) && ((vs = P.debounceRendering) || setTimeout)(dr);
}
function dr() {
  for (var e; dr.__r = Sn.length; ) e = Sn.sort(function(t, n) {
    return t.__v.__b - n.__v.__b;
  }), Sn = [], e.some(function(t) {
    var n, r, o, i, s, c;
    t.__d && (s = (i = (n = t).__v).__e, (c = n.__P) && (r = [], (o = tt({}, i)).__v = i.__v + 1, si(c, i, o, n.__n, c.ownerSVGElement !== void 0, i.__h != null ? [s] : null, r, s == null ? jt(i) : s, i.__h), Ka(r, i), i.__e != s && Va(i)));
  });
}
function ja(e, t, n, r, o, i, s, c, u, l) {
  var a, d, p, h, m, w, y, v = r && r.__k || Wa, E = v.length;
  for (n.__k = [], a = 0; a < t.length; a++) if ((h = n.__k[a] = (h = t[a]) == null || typeof h == "boolean" ? null : typeof h == "string" || typeof h == "number" || typeof h == "bigint" ? Tn(null, h, null, null, h) : Array.isArray(h) ? Tn(Me, { children: h }, null, null, null) : h.__b > 0 ? Tn(h.type, h.props, h.key, null, h.__v) : h) != null) {
    if (h.__ = n, h.__b = n.__b + 1, (p = v[a]) === null || p && h.key == p.key && h.type === p.type) v[a] = void 0;
    else for (d = 0; d < E; d++) {
      if ((p = v[d]) && h.key == p.key && h.type === p.type) {
        v[d] = void 0;
        break;
      }
      p = null;
    }
    si(e, h, p = p || ur, o, i, s, c, u, l), m = h.__e, (d = h.ref) && p.ref != d && (y || (y = []), p.ref && y.push(p.ref, null, h), y.push(d, h.__c || m, h)), m != null ? (w == null && (w = m), typeof h.type == "function" && h.__k === p.__k ? h.__d = u = qa(h, u, e) : u = Xa(e, h, p, v, m, u), typeof n.type == "function" && (n.__d = u)) : u && p.__e == u && u.parentNode != e && (u = jt(p));
  }
  for (n.__e = w, a = E; a--; ) v[a] != null && (typeof n.type == "function" && v[a].__e != null && v[a].__e == n.__d && (n.__d = jt(r, a + 1)), Ja(v[a], v[a]));
  if (y) for (a = 0; a < y.length; a++) Za(y[a], y[++a], y[++a]);
}
function qa(e, t, n) {
  for (var r, o = e.__k, i = 0; o && i < o.length; i++) (r = o[i]) && (r.__ = e, t = typeof r.type == "function" ? qa(r, t, n) : Xa(n, r, r, o, r.__e, t));
  return t;
}
function Cn(e, t) {
  return t = t || [], e == null || typeof e == "boolean" || (Array.isArray(e) ? e.some(function(n) {
    Cn(n, t);
  }) : t.push(e)), t;
}
function Xa(e, t, n, r, o, i) {
  var s, c, u;
  if (t.__d !== void 0) s = t.__d, t.__d = void 0;
  else if (n == null || o != i || o.parentNode == null) e: if (i == null || i.parentNode !== e) e.appendChild(o), s = null;
  else {
    for (c = i, u = 0; (c = c.nextSibling) && u < r.length; u += 2) if (c == o) break e;
    e.insertBefore(o, i), s = i;
  }
  return s !== void 0 ? s : o.nextSibling;
}
function uu(e, t, n, r, o) {
  var i;
  for (i in n) i === "children" || i === "key" || i in t || fr(e, i, null, n[i], r);
  for (i in t) o && typeof t[i] != "function" || i === "children" || i === "key" || i === "value" || i === "checked" || n[i] === t[i] || fr(e, i, t[i], n[i], r);
}
function _s(e, t, n) {
  t[0] === "-" ? e.setProperty(t, n) : e[t] = n == null ? "" : typeof n != "number" || lu.test(t) ? n : n + "px";
}
function fr(e, t, n, r, o) {
  var i;
  e: if (t === "style") if (typeof n == "string") e.style.cssText = n;
  else {
    if (typeof r == "string" && (e.style.cssText = r = ""), r) for (t in r) n && t in n || _s(e.style, t, "");
    if (n) for (t in n) r && n[t] === r[t] || _s(e.style, t, n[t]);
  }
  else if (t[0] === "o" && t[1] === "n") i = t !== (t = t.replace(/Capture$/, "")), t = t.toLowerCase() in e ? t.toLowerCase().slice(2) : t.slice(2), e.l || (e.l = {}), e.l[t + i] = n, n ? r || e.addEventListener(t, i ? ws : ys, i) : e.removeEventListener(t, i ? ws : ys, i);
  else if (t !== "dangerouslySetInnerHTML") {
    if (o) t = t.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if (t !== "href" && t !== "list" && t !== "form" && t !== "tabIndex" && t !== "download" && t in e) try {
      e[t] = n == null ? "" : n;
      break e;
    } catch (s) {
    }
    typeof n == "function" || (n != null && (n !== !1 || t[0] === "a" && t[1] === "r") ? e.setAttribute(t, n) : e.removeAttribute(t));
  }
}
function ys(e) {
  this.l[e.type + !1](P.event ? P.event(e) : e);
}
function ws(e) {
  this.l[e.type + !0](P.event ? P.event(e) : e);
}
function si(e, t, n, r, o, i, s, c, u) {
  var l, a, d, p, h, m, w, y, v, E, T, k, D, N = t.type;
  if (t.constructor !== void 0) return null;
  n.__h != null && (u = n.__h, c = t.__e = n.__e, t.__h = null, i = [c]), (l = P.__b) && l(t);
  try {
    e: if (typeof N == "function") {
      if (y = t.props, v = (l = N.contextType) && r[l.__c], E = l ? v ? v.props.value : l.__ : r, n.__c ? w = (a = t.__c = n.__c).__ = a.__E : ("prototype" in N && N.prototype.render ? t.__c = a = new N(y, E) : (t.__c = a = new nt(y, E), a.constructor = N, a.render = fu), v && v.sub(a), a.props = y, a.state || (a.state = {}), a.context = E, a.__n = r, d = a.__d = !0, a.__h = []), a.__s == null && (a.__s = a.state), N.getDerivedStateFromProps != null && (a.__s == a.state && (a.__s = tt({}, a.__s)), tt(a.__s, N.getDerivedStateFromProps(y, a.__s))), p = a.props, h = a.state, d) N.getDerivedStateFromProps == null && a.componentWillMount != null && a.componentWillMount(), a.componentDidMount != null && a.__h.push(a.componentDidMount);
      else {
        if (N.getDerivedStateFromProps == null && y !== p && a.componentWillReceiveProps != null && a.componentWillReceiveProps(y, E), !a.__e && a.shouldComponentUpdate != null && a.shouldComponentUpdate(y, a.__s, E) === !1 || t.__v === n.__v) {
          a.props = y, a.state = a.__s, t.__v !== n.__v && (a.__d = !1), a.__v = t, t.__e = n.__e, t.__k = n.__k, t.__k.forEach(function(M) {
            M && (M.__ = t);
          }), a.__h.length && s.push(a);
          break e;
        }
        a.componentWillUpdate != null && a.componentWillUpdate(y, a.__s, E), a.componentDidUpdate != null && a.__h.push(function() {
          a.componentDidUpdate(p, h, m);
        });
      }
      if (a.context = E, a.props = y, a.__v = t, a.__P = e, T = P.__r, k = 0, "prototype" in N && N.prototype.render) a.state = a.__s, a.__d = !1, T && T(t), l = a.render(a.props, a.state, a.context);
      else do
        a.__d = !1, T && T(t), l = a.render(a.props, a.state, a.context), a.state = a.__s;
      while (a.__d && ++k < 25);
      a.state = a.__s, a.getChildContext != null && (r = tt(tt({}, r), a.getChildContext())), d || a.getSnapshotBeforeUpdate == null || (m = a.getSnapshotBeforeUpdate(p, h)), D = l != null && l.type === Me && l.key == null ? l.props.children : l, ja(e, Array.isArray(D) ? D : [D], t, n, r, o, i, s, c, u), a.base = t.__e, t.__h = null, a.__h.length && s.push(a), w && (a.__E = a.__ = null), a.__e = !1;
    } else i == null && t.__v === n.__v ? (t.__k = n.__k, t.__e = n.__e) : t.__e = du(n.__e, t, n, r, o, i, s, u);
    (l = P.diffed) && l(t);
  } catch (M) {
    t.__v = null, (u || i != null) && (t.__e = c, t.__h = !!u, i[i.indexOf(c)] = null), P.__e(M, t, n);
  }
}
function Ka(e, t) {
  P.__c && P.__c(t, e), e.some(function(n) {
    try {
      e = n.__h, n.__h = [], e.some(function(r) {
        r.call(n);
      });
    } catch (r) {
      P.__e(r, n.__v);
    }
  });
}
function du(e, t, n, r, o, i, s, c) {
  var u, l, a, d = n.props, p = t.props, h = t.type, m = 0;
  if (h === "svg" && (o = !0), i != null) {
    for (; m < i.length; m++) if ((u = i[m]) && "setAttribute" in u == !!h && (h ? u.localName === h : u.nodeType === 3)) {
      e = u, i[m] = null;
      break;
    }
  }
  if (e == null) {
    if (h === null) return document.createTextNode(p);
    e = o ? document.createElementNS("http://www.w3.org/2000/svg", h) : document.createElement(h, p.is && p), i = null, c = !1;
  }
  if (h === null) d === p || c && e.data === p || (e.data = p);
  else {
    if (i = i && On.call(e.childNodes), l = (d = n.props || ur).dangerouslySetInnerHTML, a = p.dangerouslySetInnerHTML, !c) {
      if (i != null) for (d = {}, m = 0; m < e.attributes.length; m++) d[e.attributes[m].name] = e.attributes[m].value;
      (a || l) && (a && (l && a.__html == l.__html || a.__html === e.innerHTML) || (e.innerHTML = a && a.__html || ""));
    }
    if (uu(e, p, d, o, c), a) t.__k = [];
    else if (m = t.props.children, ja(e, Array.isArray(m) ? m : [m], t, n, r, o && h !== "foreignObject", i, s, i ? i[0] : n.__k && jt(n, 0), c), i != null) for (m = i.length; m--; ) i[m] != null && Ya(i[m]);
    c || ("value" in p && (m = p.value) !== void 0 && (m !== e.value || h === "progress" && !m || h === "option" && m !== d.value) && fr(e, "value", m, d.value, !1), "checked" in p && (m = p.checked) !== void 0 && m !== e.checked && fr(e, "checked", m, d.checked, !1));
  }
  return e;
}
function Za(e, t, n) {
  try {
    typeof e == "function" ? e(t) : e.current = t;
  } catch (r) {
    P.__e(r, n);
  }
}
function Ja(e, t, n) {
  var r, o;
  if (P.unmount && P.unmount(e), (r = e.ref) && (r.current && r.current !== e.__e || Za(r, null, t)), (r = e.__c) != null) {
    if (r.componentWillUnmount) try {
      r.componentWillUnmount();
    } catch (i) {
      P.__e(i, t);
    }
    r.base = r.__P = null;
  }
  if (r = e.__k) for (o = 0; o < r.length; o++) r[o] && Ja(r[o], t, typeof e.type != "function");
  n || e.__e == null || Ya(e.__e), e.__e = e.__d = void 0;
}
function fu(e, t, n) {
  return this.constructor(e, n);
}
function pr(e, t, n) {
  var r, o, i;
  P.__ && P.__(e, t), o = (r = !1) ? null : t.__k, i = [], si(t, e = t.__k = pt(Me, null, [e]), o || ur, ur, t.ownerSVGElement !== void 0, o ? null : t.firstChild ? On.call(t.childNodes) : null, i, o ? o.__e : t.firstChild, r), Ka(i, e);
}
function pu(e, t, n) {
  var r, o, i, s = tt({}, e.props);
  for (i in t) i == "key" ? r = t[i] : i == "ref" ? o = t[i] : s[i] = t[i];
  return arguments.length > 2 && (s.children = arguments.length > 3 ? On.call(arguments, 2) : n), Tn(e.type, s, r || e.key, o || e.ref, null);
}
function kr(e, t) {
  var n = { __c: t = "__cC" + za++, __: e, Consumer: function(r, o) {
    return r.children(o);
  }, Provider: function(r) {
    var o, i;
    return this.getChildContext || (o = [], (i = {})[t] = this, this.getChildContext = function() {
      return i;
    }, this.shouldComponentUpdate = function(s) {
      this.props.value !== s.value && o.some($o);
    }, this.sub = function(s) {
      o.push(s);
      var c = s.componentWillUnmount;
      s.componentWillUnmount = function() {
        o.splice(o.indexOf(s), 1), c && c.call(s);
      };
    }), r.children;
  } };
  return n.Provider.__ = n.Consumer.contextType = n;
}
On = Wa.slice, P = { __e: function(e, t, n, r) {
  for (var o, i, s; t = t.__; ) if ((o = t.__c) && !o.__) try {
    if ((i = o.constructor) && i.getDerivedStateFromError != null && (o.setState(i.getDerivedStateFromError(e)), s = o.__d), o.componentDidCatch != null && (o.componentDidCatch(e, r || {}), s = o.__d), s) return o.__E = o;
  } catch (c) {
    e = c;
  }
  throw e;
} }, Ua = 0, nt.prototype.setState = function(e, t) {
  var n;
  n = this.__s != null && this.__s !== this.state ? this.__s : this.__s = tt({}, this.state), typeof e == "function" && (e = e(tt({}, n), this.props)), e && tt(n, e), e != null && this.__v && (t && this.__h.push(t), $o(this));
}, nt.prototype.forceUpdate = function(e) {
  this.__v && (this.__e = !0, e && this.__h.push(e), $o(this));
}, nt.prototype.render = Me, Sn = [], dr.__r = 0, za = 0;
var hu = 0;
function f(e, t, n, r, o) {
  var i, s, c = {};
  for (s in t) s == "ref" ? i = t[s] : c[s] = t[s];
  var u = { type: e, props: c, key: n, ref: i, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, __h: null, constructor: void 0, __v: --hu, __source: o, __self: r };
  if (typeof e == "function" && (i = e.defaultProps)) for (s in i) c[s] === void 0 && (c[s] = i[s]);
  return P.vnode && P.vnode(u), u;
}
var en, ve, io, Es, kn = 0, Qa = [], or = [], Ds = P.__b, Ss = P.__r, Ts = P.diffed, bs = P.__c, Cs = P.unmount;
function Pn(e, t) {
  P.__h && P.__h(ve, e, kn || t), kn = 0;
  var n = ve.__H || (ve.__H = { __: [], __h: [] });
  return e >= n.__.length && n.__.push({ __V: or }), n.__[e];
}
function se(e) {
  return kn = 1, ai(ec, e);
}
function ai(e, t, n) {
  var r = Pn(en++, 2);
  return r.t = e, r.__c || (r.__ = [n ? n(t) : ec(void 0, t), function(o) {
    var i = r.t(r.__[0], o);
    r.__[0] !== i && (r.__ = [i, r.__[1]], r.__c.setState({}));
  }], r.__c = ve), r.__;
}
function re(e, t) {
  var n = Pn(en++, 3);
  !P.__s && ci(n.__H, t) && (n.__ = e, n.u = t, ve.__H.__h.push(n));
}
function ht(e, t) {
  var n = Pn(en++, 4);
  !P.__s && ci(n.__H, t) && (n.__ = e, n.u = t, ve.__h.push(n));
}
function ee(e) {
  return kn = 5, U(function() {
    return { current: e };
  }, []);
}
function U(e, t) {
  var n = Pn(en++, 7);
  return ci(n.__H, t) ? (n.__V = e(), n.u = t, n.__h = e, n.__V) : n.__;
}
function J(e, t) {
  return kn = 8, U(function() {
    return e;
  }, t);
}
function Nn(e) {
  var t = ve.context[e.__c], n = Pn(en++, 9);
  return n.c = e, t ? (n.__ == null && (n.__ = !0, t.sub(ve)), t.props.value) : e.__;
}
function mu() {
  for (var e; e = Qa.shift(); ) if (e.__P) try {
    e.__H.__h.forEach(ir), e.__H.__h.forEach(Bo), e.__H.__h = [];
  } catch (t) {
    e.__H.__h = [], P.__e(t, e.__v);
  }
}
P.__b = function(e) {
  ve = null, Ds && Ds(e);
}, P.__r = function(e) {
  Ss && Ss(e), en = 0;
  var t = (ve = e.__c).__H;
  t && (io === ve ? (t.__h = [], ve.__h = [], t.__.forEach(function(n) {
    n.__V = or, n.u = void 0;
  })) : (t.__h.forEach(ir), t.__h.forEach(Bo), t.__h = [])), io = ve;
}, P.diffed = function(e) {
  Ts && Ts(e);
  var t = e.__c;
  t && t.__H && (t.__H.__h.length && (Qa.push(t) !== 1 && Es === P.requestAnimationFrame || ((Es = P.requestAnimationFrame) || function(n) {
    var r, o = function() {
      clearTimeout(i), ks && cancelAnimationFrame(r), setTimeout(n);
    }, i = setTimeout(o, 100);
    ks && (r = requestAnimationFrame(o));
  })(mu)), t.__H.__.forEach(function(n) {
    n.u && (n.__H = n.u), n.__V !== or && (n.__ = n.__V), n.u = void 0, n.__V = or;
  })), io = ve = null;
}, P.__c = function(e, t) {
  t.some(function(n) {
    try {
      n.__h.forEach(ir), n.__h = n.__h.filter(function(r) {
        return !r.__ || Bo(r);
      });
    } catch (r) {
      t.some(function(o) {
        o.__h && (o.__h = []);
      }), t = [], P.__e(r, n.__v);
    }
  }), bs && bs(e, t);
}, P.unmount = function(e) {
  Cs && Cs(e);
  var t, n = e.__c;
  n && n.__H && (n.__H.__.forEach(function(r) {
    try {
      ir(r);
    } catch (o) {
      t = o;
    }
  }), t && P.__e(t, n.__v));
};
var ks = typeof requestAnimationFrame == "function";
function ir(e) {
  var t = ve, n = e.__c;
  typeof n == "function" && (e.__c = void 0, n()), ve = t;
}
function Bo(e) {
  var t = ve;
  e.__c = e.__(), ve = t;
}
function ci(e, t) {
  return !e || e.length !== t.length || t.some(function(n, r) {
    return n !== e[r];
  });
}
function ec(e, t) {
  return typeof t == "function" ? t(e) : t;
}
function Ee(e) {
  for (var t = arguments.length, n = Array(t > 1 ? t - 1 : 0), r = 1; r < t; r++) n[r - 1] = arguments[r];
  if (process.env.NODE_ENV !== "production") {
    var o = Su[e], i = o ? typeof o == "function" ? o.apply(null, n) : o : "unknown error nr: " + e;
    throw Error("[Immer] " + i);
  }
  throw Error("[Immer] minified error nr: " + e + (n.length ? " " + n.map((function(s) {
    return "'" + s + "'";
  })).join(",") : "") + ". Find the full error at: https://bit.ly/3cXEKWf");
}
function qt(e) {
  return !!e && !!e[Pe];
}
function Tt(e) {
  return !!e && ((function(t) {
    if (!t || typeof t != "object") return !1;
    var n = Object.getPrototypeOf(t);
    if (n === null) return !0;
    var r = Object.hasOwnProperty.call(n, "constructor") && n.constructor;
    return r === Object || typeof r == "function" && Function.toString.call(r) === Tu;
  })(e) || Array.isArray(e) || !!e[Ps] || !!e.constructor[Ps] || li(e) || ui(e));
}
function In(e, t, n) {
  n === void 0 && (n = !1), tn(e) === 0 ? (n ? Object.keys : mi)(e).forEach((function(r) {
    n && typeof r == "symbol" || t(r, e[r], e);
  })) : e.forEach((function(r, o) {
    return t(o, r, e);
  }));
}
function tn(e) {
  var t = e[Pe];
  return t ? t.i > 3 ? t.i - 4 : t.i : Array.isArray(e) ? 1 : li(e) ? 2 : ui(e) ? 3 : 0;
}
function Fo(e, t) {
  return tn(e) === 2 ? e.has(t) : Object.prototype.hasOwnProperty.call(e, t);
}
function gu(e, t) {
  return tn(e) === 2 ? e.get(t) : e[t];
}
function tc(e, t, n) {
  var r = tn(e);
  r === 2 ? e.set(t, n) : r === 3 ? (e.delete(t), e.add(n)) : e[t] = n;
}
function vu(e, t) {
  return e === t ? e !== 0 || 1 / e == 1 / t : e != e && t != t;
}
function li(e) {
  return Eu && e instanceof Map;
}
function ui(e) {
  return Du && e instanceof Set;
}
function St(e) {
  return e.o || e.t;
}
function di(e) {
  if (Array.isArray(e)) return Array.prototype.slice.call(e);
  var t = bu(e);
  delete t[Pe];
  for (var n = mi(t), r = 0; r < n.length; r++) {
    var o = n[r], i = t[o];
    i.writable === !1 && (i.writable = !0, i.configurable = !0), (i.get || i.set) && (t[o] = { configurable: !0, writable: !0, enumerable: i.enumerable, value: e[o] });
  }
  return Object.create(Object.getPrototypeOf(e), t);
}
function fi(e, t) {
  return t === void 0 && (t = !1), pi(e) || qt(e) || !Tt(e) || (tn(e) > 1 && (e.set = e.add = e.clear = e.delete = _u), Object.freeze(e), t && In(e, (function(n, r) {
    return fi(r, !0);
  }), !0)), e;
}
function _u() {
  Ee(2);
}
function pi(e) {
  return e == null || typeof e != "object" || Object.isFrozen(e);
}
function qe(e) {
  var t = Cu[e];
  return t || Ee(18, e), t;
}
function Ns() {
  return process.env.NODE_ENV === "production" || Xt || Ee(0), Xt;
}
function so(e, t) {
  t && (qe("Patches"), e.u = [], e.s = [], e.v = t);
}
function hr(e) {
  Go(e), e.p.forEach(yu), e.p = null;
}
function Go(e) {
  e === Xt && (Xt = e.l);
}
function Is(e) {
  return Xt = { p: [], l: Xt, h: e, m: !0, _: 0 };
}
function yu(e) {
  var t = e[Pe];
  t.i === 0 || t.i === 1 ? t.j() : t.O = !0;
}
function ao(e, t) {
  t._ = t.p.length;
  var n = t.p[0], r = e !== void 0 && e !== n;
  return t.h.g || qe("ES5").S(t, e, r), r ? (n[Pe].P && (hr(t), Ee(4)), Tt(e) && (e = mr(t, e), t.l || gr(t, e)), t.u && qe("Patches").M(n[Pe].t, e, t.u, t.s)) : e = mr(t, n, []), hr(t), t.u && t.v(t.u, t.s), e !== nc ? e : void 0;
}
function mr(e, t, n) {
  if (pi(t)) return t;
  var r = t[Pe];
  if (!r) return In(t, (function(i, s) {
    return Ms(e, r, t, i, s, n);
  }), !0), t;
  if (r.A !== e) return t;
  if (!r.P) return gr(e, r.t, !0), r.t;
  if (!r.I) {
    r.I = !0, r.A._--;
    var o = r.i === 4 || r.i === 5 ? r.o = di(r.k) : r.o;
    In(r.i === 3 ? new Set(o) : o, (function(i, s) {
      return Ms(e, r, o, i, s, n);
    })), gr(e, o, !1), n && e.u && qe("Patches").R(r, n, e.u, e.s);
  }
  return r.o;
}
function Ms(e, t, n, r, o, i) {
  if (process.env.NODE_ENV !== "production" && o === n && Ee(5), qt(o)) {
    var s = mr(e, o, i && t && t.i !== 3 && !Fo(t.D, r) ? i.concat(r) : void 0);
    if (tc(n, r, s), !qt(s)) return;
    e.m = !1;
  }
  if (Tt(o) && !pi(o)) {
    if (!e.h.F && e._ < 1) return;
    mr(e, o), t && t.A.l || gr(e, o);
  }
}
function gr(e, t, n) {
  n === void 0 && (n = !1), e.h.F && e.m && fi(t, n);
}
function co(e, t) {
  var n = e[Pe];
  return (n ? St(n) : e)[t];
}
function As(e, t) {
  if (t in e) for (var n = Object.getPrototypeOf(e); n; ) {
    var r = Object.getOwnPropertyDescriptor(n, t);
    if (r) return r;
    n = Object.getPrototypeOf(n);
  }
}
function Uo(e) {
  e.P || (e.P = !0, e.l && Uo(e.l));
}
function lo(e) {
  e.o || (e.o = di(e.t));
}
function zo(e, t, n) {
  var r = li(t) ? qe("MapSet").N(t, n) : ui(t) ? qe("MapSet").T(t, n) : e.g ? (function(o, i) {
    var s = Array.isArray(o), c = { i: s ? 1 : 0, A: i ? i.A : Ns(), P: !1, I: !1, D: {}, l: i, t: o, k: null, o: null, j: null, C: !1 }, u = c, l = Wo;
    s && (u = [c], l = En);
    var a = Proxy.revocable(u, l), d = a.revoke, p = a.proxy;
    return c.k = p, c.j = d, p;
  })(t, n) : qe("ES5").J(t, n);
  return (n ? n.A : Ns()).p.push(r), r;
}
function wu(e) {
  return qt(e) || Ee(22, e), (function t(n) {
    if (!Tt(n)) return n;
    var r, o = n[Pe], i = tn(n);
    if (o) {
      if (!o.P && (o.i < 4 || !qe("ES5").K(o))) return o.t;
      o.I = !0, r = Rs(n, i), o.I = !1;
    } else r = Rs(n, i);
    return In(r, (function(s, c) {
      o && gu(o.t, s) === c || tc(r, s, t(c));
    })), i === 3 ? new Set(r) : r;
  })(e);
}
function Rs(e, t) {
  switch (t) {
    case 2:
      return new Map(e);
    case 3:
      return Array.from(e);
  }
  return di(e);
}
var xs, Xt, hi = typeof Symbol != "undefined" && typeof Symbol("x") == "symbol", Eu = typeof Map != "undefined", Du = typeof Set != "undefined", Os = typeof Proxy != "undefined" && Proxy.revocable !== void 0 && typeof Reflect != "undefined", nc = hi ? Symbol.for("immer-nothing") : ((xs = {})["immer-nothing"] = !0, xs), Ps = hi ? Symbol.for("immer-draftable") : "__$immer_draftable", Pe = hi ? Symbol.for("immer-state") : "__$immer_state", Su = { 0: "Illegal state", 1: "Immer drafts cannot have computed properties", 2: "This object has been frozen and should not be mutated", 3: function(e) {
  return "Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? " + e;
}, 4: "An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.", 5: "Immer forbids circular references", 6: "The first or second argument to `produce` must be a function", 7: "The third argument to `produce` must be a function or undefined", 8: "First argument to `createDraft` must be a plain object, an array, or an immerable object", 9: "First argument to `finishDraft` must be a draft returned by `createDraft`", 10: "The given draft is already finalized", 11: "Object.defineProperty() cannot be used on an Immer draft", 12: "Object.setPrototypeOf() cannot be used on an Immer draft", 13: "Immer only supports deleting array indices", 14: "Immer only supports setting array indices and the 'length' property", 15: function(e) {
  return "Cannot apply patch, path doesn't resolve: " + e;
}, 16: 'Sets cannot have "replace" patches.', 17: function(e) {
  return "Unsupported patch operation: " + e;
}, 18: function(e) {
  return "The plugin for '" + e + "' has not been loaded into Immer. To enable the plugin, import and call `enable" + e + "()` when initializing your application.";
}, 20: "Cannot use proxies if Proxy, Proxy.revocable or Reflect are not available", 21: function(e) {
  return "produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '" + e + "'";
}, 22: function(e) {
  return "'current' expects a draft, got: " + e;
}, 23: function(e) {
  return "'original' expects a draft, got: " + e;
}, 24: "Patching reserved attributes like __proto__, prototype and constructor is not allowed" }, Tu = "" + Object.prototype.constructor, mi = typeof Reflect != "undefined" && Reflect.ownKeys ? Reflect.ownKeys : Object.getOwnPropertySymbols !== void 0 ? function(e) {
  return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e));
} : Object.getOwnPropertyNames, bu = Object.getOwnPropertyDescriptors || function(e) {
  var t = {};
  return mi(e).forEach((function(n) {
    t[n] = Object.getOwnPropertyDescriptor(e, n);
  })), t;
}, Cu = {}, Wo = { get: function(e, t) {
  if (t === Pe) return e;
  var n = St(e);
  if (!Fo(n, t)) return (function(o, i, s) {
    var c, u = As(i, s);
    return u ? "value" in u ? u.value : (c = u.get) === null || c === void 0 ? void 0 : c.call(o.k) : void 0;
  })(e, n, t);
  var r = n[t];
  return e.I || !Tt(r) ? r : r === co(e.t, t) ? (lo(e), e.o[t] = zo(e.A.h, r, e)) : r;
}, has: function(e, t) {
  return t in St(e);
}, ownKeys: function(e) {
  return Reflect.ownKeys(St(e));
}, set: function(e, t, n) {
  var r = As(St(e), t);
  if (r != null && r.set) return r.set.call(e.k, n), !0;
  if (!e.P) {
    var o = co(St(e), t), i = o == null ? void 0 : o[Pe];
    if (i && i.t === n) return e.o[t] = n, e.D[t] = !1, !0;
    if (vu(n, o) && (n !== void 0 || Fo(e.t, t))) return !0;
    lo(e), Uo(e);
  }
  return e.o[t] === n && typeof n != "number" && (n !== void 0 || t in e.o) || (e.o[t] = n, e.D[t] = !0, !0);
}, deleteProperty: function(e, t) {
  return co(e.t, t) !== void 0 || t in e.t ? (e.D[t] = !1, lo(e), Uo(e)) : delete e.D[t], e.o && delete e.o[t], !0;
}, getOwnPropertyDescriptor: function(e, t) {
  var n = St(e), r = Reflect.getOwnPropertyDescriptor(n, t);
  return r && { writable: !0, configurable: e.i !== 1 || t !== "length", enumerable: r.enumerable, value: n[t] };
}, defineProperty: function() {
  Ee(11);
}, getPrototypeOf: function(e) {
  return Object.getPrototypeOf(e.t);
}, setPrototypeOf: function() {
  Ee(12);
} }, En = {};
In(Wo, (function(e, t) {
  En[e] = function() {
    return arguments[0] = arguments[0][0], t.apply(this, arguments);
  };
})), En.deleteProperty = function(e, t) {
  return process.env.NODE_ENV !== "production" && isNaN(parseInt(t)) && Ee(13), En.set.call(this, e, t, void 0);
}, En.set = function(e, t, n) {
  return process.env.NODE_ENV !== "production" && t !== "length" && isNaN(parseInt(t)) && Ee(14), Wo.set.call(this, e[0], t, n, e[0]);
};
var ku = (function() {
  function e(n) {
    var r = this;
    this.g = Os, this.F = !0, this.produce = function(o, i, s) {
      if (typeof o == "function" && typeof i != "function") {
        var c = i;
        i = o;
        var u = r;
        return function(w) {
          var y = this;
          w === void 0 && (w = c);
          for (var v = arguments.length, E = Array(v > 1 ? v - 1 : 0), T = 1; T < v; T++) E[T - 1] = arguments[T];
          return u.produce(w, (function(k) {
            var D;
            return (D = i).call.apply(D, [y, k].concat(E));
          }));
        };
      }
      var l;
      if (typeof i != "function" && Ee(6), s !== void 0 && typeof s != "function" && Ee(7), Tt(o)) {
        var a = Is(r), d = zo(r, o, void 0), p = !0;
        try {
          l = i(d), p = !1;
        } finally {
          p ? hr(a) : Go(a);
        }
        return typeof Promise != "undefined" && l instanceof Promise ? l.then((function(w) {
          return so(a, s), ao(w, a);
        }), (function(w) {
          throw hr(a), w;
        })) : (so(a, s), ao(l, a));
      }
      if (!o || typeof o != "object") {
        if ((l = i(o)) === void 0 && (l = o), l === nc && (l = void 0), r.F && fi(l, !0), s) {
          var h = [], m = [];
          qe("Patches").M(o, l, h, m), s(h, m);
        }
        return l;
      }
      Ee(21, o);
    }, this.produceWithPatches = function(o, i) {
      if (typeof o == "function") return function(l) {
        for (var a = arguments.length, d = Array(a > 1 ? a - 1 : 0), p = 1; p < a; p++) d[p - 1] = arguments[p];
        return r.produceWithPatches(l, (function(h) {
          return o.apply(void 0, [h].concat(d));
        }));
      };
      var s, c, u = r.produce(o, i, (function(l, a) {
        s = l, c = a;
      }));
      return typeof Promise != "undefined" && u instanceof Promise ? u.then((function(l) {
        return [l, s, c];
      })) : [u, s, c];
    }, typeof (n == null ? void 0 : n.useProxies) == "boolean" && this.setUseProxies(n.useProxies), typeof (n == null ? void 0 : n.autoFreeze) == "boolean" && this.setAutoFreeze(n.autoFreeze);
  }
  var t = e.prototype;
  return t.createDraft = function(n) {
    Tt(n) || Ee(8), qt(n) && (n = wu(n));
    var r = Is(this), o = zo(this, n, void 0);
    return o[Pe].C = !0, Go(r), o;
  }, t.finishDraft = function(n, r) {
    var o = n && n[Pe];
    process.env.NODE_ENV !== "production" && (o && o.C || Ee(9), o.I && Ee(10));
    var i = o.A;
    return so(i, r), ao(void 0, i);
  }, t.setAutoFreeze = function(n) {
    this.F = n;
  }, t.setUseProxies = function(n) {
    n && !Os && Ee(20), this.g = n;
  }, t.applyPatches = function(n, r) {
    var o;
    for (o = r.length - 1; o >= 0; o--) {
      var i = r[o];
      if (i.path.length === 0 && i.op === "replace") {
        n = i.value;
        break;
      }
    }
    o > -1 && (r = r.slice(o + 1));
    var s = qe("Patches").$;
    return qt(n) ? s(n, r) : this.produce(n, (function(c) {
      return s(c, r);
    }));
  }, e;
})(), Le = new ku(), Z = Le.produce;
Le.produceWithPatches.bind(Le);
Le.setAutoFreeze.bind(Le);
Le.setUseProxies.bind(Le);
Le.applyPatches.bind(Le);
Le.createDraft.bind(Le);
Le.finishDraft.bind(Le);
function st(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var uo, Ls;
function Nr() {
  if (Ls) return uo;
  Ls = 1;
  function e(t) {
    return t === void 0;
  }
  return uo = e, uo;
}
var fo, Hs;
function Nu() {
  if (Hs) return fo;
  Hs = 1;
  var e = Nr();
  function t(n, r, o) {
    var i = [], s;
    for (e(r) && (r = n || 0, n = 0), o = o || 1, s = o < 0 ? -1 : 1, r *= s; n * s < r; n += o)
      i.push(n);
    return i;
  }
  return fo = t, fo;
}
var Iu = Nu();
const mt = /* @__PURE__ */ st(Iu), Mu = "0", Kt = 17, Ir = 2, gi = 3, Mr = 27, po = 5, Au = 280, sr = 44, Yo = 12, Ru = 12, xu = "12px 17px 0", rc = 42, oc = 1, ic = 2, Zt = 72, $s = {
  color: "#000",
  backgroundColor: "#a1b56c",
  dragBackgroundColor: "#a1b56c",
  borderColor: "#000"
}, vr = 2, Bs = 9;
var Ou = Nr();
const Ze = /* @__PURE__ */ st(Ou);
var ho, Fs;
function Pu() {
  if (Fs) return ho;
  Fs = 1;
  function e(t) {
    return typeof t == "boolean" || t instanceof Boolean;
  }
  return ho = e, ho;
}
var Lu = Pu();
const vi = /* @__PURE__ */ st(Lu);
var mo, Gs;
function Hu() {
  if (Gs) return mo;
  Gs = 1;
  function e(t) {
    return typeof t == "number" || t instanceof Number;
  }
  return mo = e, mo;
}
var $u = Hu();
const ar = /* @__PURE__ */ st($u);
var go, Us;
function sc() {
  if (Us) return go;
  Us = 1;
  function e(t) {
    return t === Object(t);
  }
  return go = e, go;
}
var Bu = sc();
const vo = /* @__PURE__ */ st(Bu);
var _o, zs;
function ac() {
  if (zs) return _o;
  zs = 1;
  function e(t) {
    return typeof t == "string" || t instanceof String;
  }
  return _o = e, _o;
}
var Fu = ac();
const be = /* @__PURE__ */ st(Fu);
function z(e) {
  return Ze(e) || e === null;
}
function x(e) {
  return !z(e);
}
function bn(e) {
  return typeof e == "function";
}
const Gu = "toastui-calendar-";
function _(...e) {
  const t = [];
  return e.forEach((n) => {
    n && (be(n) ? t.push(n) : Object.keys(n).forEach((r) => {
      n[r] && t.push(r);
    }));
  }), t.map((n) => `${Gu}${n}`).join(" ");
}
function q(e) {
  return `${e}%`;
}
function _r(e) {
  return `${e}px`;
}
function Vo(e) {
  const t = /(\d+)%/, n = e.match(t), r = /(-?)\s?(\d+)px/, o = e.match(r);
  return {
    percent: n ? parseInt(n[1], 10) : 0,
    px: o ? parseInt(`${o[1]}${o[2]}`, 10) : 0
  };
}
function cc(e, t) {
  const n = e.model.getColors();
  return Object.keys($s).reduce((r, o) => {
    var s, c;
    const i = o;
    return r[i] = (c = (s = n[i]) != null ? s : t[i]) != null ? c : $s[i], r;
  }, {});
}
const Uu = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.)?([0-9]+)?([+-]\d\d(?::?\d\d)?|\s*Z)?$/;
function Ws() {
  throw new Error("This operation is not supported.");
}
function zu(e) {
  const t = Uu.exec(e);
  if (t) {
    const [, n, r, o, i, s, c, , u, l] = t;
    return {
      y: Number(n),
      M: Number(r) - 1,
      d: Number(o),
      h: Number(i),
      m: Number(s),
      s: Number(c),
      ms: Number(u) || 0,
      zoneInfo: l
    };
  }
  return null;
}
function Wu(e) {
  const t = zu(e);
  if (t && !t.zoneInfo) {
    const { y: n, M: r, d: o, h: i, m: s, s: c, ms: u } = t;
    return new Date(n, r, o, i, s, c, u);
  }
  return null;
}
class nn {
  constructor(...t) {
    const [n] = t;
    n instanceof Date ? this.d = new Date(n.getTime()) : be(n) && t.length === 1 && (this.d = Wu(n)), this.d || (this.d = new Date(...t));
  }
  setTimezoneOffset() {
    Ws();
  }
  setTimezoneName() {
    Ws();
  }
  clone() {
    return new nn(this.d);
  }
  toDate() {
    return new Date(this.d.getTime());
  }
  toString() {
    return this.d.toString();
  }
}
const Yu = [
  "getTime",
  "getTimezoneOffset",
  "getFullYear",
  "getMonth",
  "getDate",
  "getHours",
  "getMinutes",
  "getSeconds",
  "getMilliseconds",
  "getDay"
], Vu = [
  "setTime",
  "setFullYear",
  "setMonth",
  "setDate",
  "setHours",
  "setMinutes",
  "setSeconds",
  "setMilliseconds"
];
Yu.forEach((e) => {
  nn.prototype[e] = function(...t) {
    return this.d[e](...t);
  };
});
Vu.forEach((e) => {
  nn.prototype[e] = function(...t) {
    return this.d[e](...t);
  };
});
class Ar extends nn {
  clone() {
    return new Ar(this.d);
  }
  getTimezoneOffset() {
    return 0;
  }
}
const ju = [
  "FullYear",
  "Month",
  "Date",
  "Hours",
  "Minutes",
  "Seconds",
  "Milliseconds",
  "Day"
], qu = [
  "FullYear",
  "Month",
  "Date",
  "Hours",
  "Minutes",
  "Seconds",
  "Milliseconds"
];
ju.forEach((e) => {
  const t = `get${e}`;
  Ar.prototype[t] = function(...n) {
    return this.d[`getUTC${e}`](...n);
  };
});
qu.forEach((e) => {
  const t = `set${e}`;
  Ar.prototype[t] = function(...n) {
    return this.d[`setUTC${e}`](...n);
  };
});
const Xu = "Invalid DateTime Format", Ku = "Invalid IANA Timezone Name", Zu = "Invalid View Type", Mn = "@toast-ui/calendar: ";
class Ju extends Error {
  constructor(t) {
    super(`${Mn}${Ku} - ${t}`), this.name = "InvalidTimezoneNameError";
  }
}
class Qu extends Error {
  constructor(t) {
    super(`${Mn}${Xu} - ${t}`), this.name = "InvalidDateTimeFormatError";
  }
}
class ed extends Error {
  constructor(t) {
    super(`${Mn}${Zu} - ${t}`), this.name = "InvalidViewTypeError";
  }
}
const td = {
  error: (e, ...t) => {
    console.error(`${Mn}${e}`, ...t);
  },
  warn: (e, ...t) => {
    console.warn(`${Mn}${e}`, ...t);
  }
};
let nd = nn;
function Ys(...e) {
  return new nd(...e);
}
function rd() {
  return -(/* @__PURE__ */ new Date()).getTimezoneOffset();
}
function Vs(e, t = new O()) {
  if (!od())
    return td.warn(
      `Intl.DateTimeFormat is not fully supported. So It will return the local timezone offset only.
You can use a polyfill to fix this issue.`
    ), -t.toDate().getTimezoneOffset();
  id(e);
  const n = cd(t, e), r = ld(n);
  return Math.round((r.getTime() - t.getTime()) / 60 / 1e3);
}
function _n(e, t) {
  const n = new O(e.getFullYear(), 0, 1), r = new O(e.getFullYear(), 6, 1);
  return Math.max(n.getTimezoneOffset(), r.getTimezoneOffset()) !== e.toDate().getTimezoneOffset();
}
const yo = {}, js = {};
function od() {
  var e, t;
  return bn((t = (e = Intl == null ? void 0 : Intl.DateTimeFormat) == null ? void 0 : e.prototype) == null ? void 0 : t.formatToParts);
}
function id(e) {
  if (js[e])
    return !0;
  try {
    return Intl.DateTimeFormat("en-US", { timeZone: e }), js[e] = !0, !0;
  } catch (t) {
    throw new Ju(e);
  }
}
function sd(e) {
  if (yo[e])
    return yo[e];
  const t = new Intl.DateTimeFormat("en-US", {
    timeZone: e,
    hourCycle: "h23",
    hour12: !1,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  });
  return yo[e] = t, t;
}
const ad = {
  year: 0,
  month: 1,
  day: 2,
  hour: 3,
  minute: 4,
  second: 5
};
function cd(e, t) {
  return sd(t).formatToParts(e.toDate()).reduce((o, i) => {
    const s = ad[i.type];
    return x(s) && (o[s] = parseInt(i.value, 10)), o;
  }, []);
}
function ld(e) {
  const [t, n, r, o, i, s] = e, c = n - 1;
  return new Date(Date.UTC(t, c, r, o % 24, i, s));
}
function wo(e) {
  return (rd() - e) * yi;
}
class O {
  constructor(...t) {
    this.tzOffset = null, t[0] instanceof O ? this.d = Ys(t[0].getTime()) : this.d = Ys(...t);
  }
  /**
   * Get the string representation of the date.
   * @returns {string} string representation of the date.
   */
  toString() {
    return this.d.toString();
  }
  /**
   * Add years to the instance.
   * @param {number} y - number of years to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addFullYear(t) {
    return this.setFullYear(this.getFullYear() + t), this;
  }
  /**
   * Add months to the instance.
   * @param {number} m - number of months to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addMonth(t) {
    return this.setMonth(this.getMonth() + t), this;
  }
  /**
   * Add dates to the instance.
   * @param {number} d - number of days to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addDate(t) {
    return this.setDate(this.getDate() + t), this;
  }
  /**
   * Add hours to the instance.
   * @param {number} h - number of hours to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addHours(t) {
    return this.setHours(this.getHours() + t), this;
  }
  /**
   * Add minutes to the instance.
   * @param {number} M - number of minutes to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addMinutes(t) {
    return this.setMinutes(this.getMinutes() + t), this;
  }
  /**
   * Add seconds to the instance.
   * @param {number} s - number of seconds to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addSeconds(t) {
    return this.setSeconds(this.getSeconds() + t), this;
  }
  /**
   * Add milliseconds to the instance.
   * @param {number} ms - number of milliseconds to be added.
   * @returns {TZDate} - returns the instance itself.
   */
  addMilliseconds(t) {
    return this.setMilliseconds(this.getMilliseconds() + t), this;
  }
  /* eslint-disable max-params*/
  /**
   * Set the date and time all at once.
   * @param {number} y - year
   * @param {number} m - month
   * @param {number} d - date
   * @param {number} h - hours
   * @param {number} M - minutes
   * @param {number} s - seconds
   * @param {number} ms - milliseconds
   * @returns {TZDate} - returns the instance itself.
   */
  setWithRaw(t, n, r, o, i, s, c) {
    return this.setFullYear(t, n, r), this.setHours(o, i, s, c), this;
  }
  /**
   * Convert the instance to the native `Date` object.
   * @returns {Date} - The native `Date` object.
   */
  toDate() {
    return this.d.toDate();
  }
  /**
   * Get the value of the date. (milliseconds since 1970-01-01 00:00:00 (UTC+0))
   * @returns {number} - value of the date.
   */
  valueOf() {
    return this.getTime();
  }
  /**
   * Get the timezone offset from UTC in minutes.
   * @returns {number} - timezone offset in minutes.
   */
  getTimezoneOffset() {
    var t;
    return (t = this.tzOffset) != null ? t : this.d.getTimezoneOffset();
  }
  // Native properties
  /**
   * Get milliseconds which is converted by timezone
   * @returns {number} milliseconds
   */
  getTime() {
    return this.d.getTime();
  }
  /**
   * Get the year of the instance.
   * @returns {number} - full year
   */
  getFullYear() {
    return this.d.getFullYear();
  }
  /**
   * Get the month of the instance. (zero-based)
   * @returns {number} - month
   */
  getMonth() {
    return this.d.getMonth();
  }
  /**
   * Get the date of the instance.
   * @returns {number} - date
   */
  getDate() {
    return this.d.getDate();
  }
  /**
   * Get the hours of the instance.
   * @returns {number} - hours
   */
  getHours() {
    return this.d.getHours();
  }
  /**
   * Get the minutes of the instance.
   * @returns {number} - minutes
   */
  getMinutes() {
    return this.d.getMinutes();
  }
  /**
   * Get the seconds of the instance.
   * @returns {number} - seconds
   */
  getSeconds() {
    return this.d.getSeconds();
  }
  /**
   * Get the milliseconds of the instance.
   * @returns {number} - milliseconds
   */
  getMilliseconds() {
    return this.d.getMilliseconds();
  }
  /**
   * Get the day of the week of the instance.
   * @returns {number} - day of the week
   */
  getDay() {
    return this.d.getDay();
  }
  /**
   * Sets the instance to the time represented by a number of milliseconds since 1970-01-01 00:00:00 (UTC+0).
   * @param {number} t - number of milliseconds
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setTime(t) {
    return this.d.setTime(t);
  }
  /**
   * Sets the year-month-date of the instance. Equivalent to calling `setFullYear` of `Date` object.
   * @param {number} y - year
   * @param {number} m - month (zero-based)
   * @param {number} d - date
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setFullYear(t, n = this.getMonth(), r = this.getDate()) {
    return this.d.setFullYear(t, n, r);
  }
  /**
   * Sets the month of the instance. Equivalent to calling `setMonth` of `Date` object.
   * @param {number} m - month (zero-based)
   * @param {number} d - date
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setMonth(t, n = this.getDate()) {
    return this.d.setMonth(t, n);
  }
  /**
   * Sets the date of the instance. Equivalent to calling `setDate` of `Date` object.
   * @param {number} d - date
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setDate(t) {
    return this.d.setDate(t);
  }
  /**
   * Sets the hours of the instance. Equivalent to calling `setHours` of `Date` object.
   * @param {number} h - hours
   * @param {number} M - minutes
   * @param {number} s - seconds
   * @param {number} ms - milliseconds
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setHours(t, n = this.getMinutes(), r = this.getSeconds(), o = this.getMilliseconds()) {
    return this.d.setHours(t, n, r, o);
  }
  /**
   * Sets the minutes of the instance. Equivalent to calling `setMinutes` of `Date` object.
   * @param {number} M - minutes
   * @param {number} s - seconds
   * @param {number} ms - milliseconds
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setMinutes(t, n = this.getSeconds(), r = this.getMilliseconds()) {
    return this.d.setMinutes(t, n, r);
  }
  /**
   * Sets the seconds of the instance. Equivalent to calling `setSeconds` of `Date` object.
   * @param {number} s - seconds
   * @param {number} ms - milliseconds
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setSeconds(t, n = this.getMilliseconds()) {
    return this.d.setSeconds(t, n);
  }
  /**
   * Sets the milliseconds of the instance. Equivalent to calling `setMilliseconds` of `Date` object.
   * @param {number} ms - milliseconds
   * @returns {number} - Passed milliseconds of the instance since 1970-01-01 00:00:00 (UTC+0).
   */
  setMilliseconds(t) {
    return this.d.setMilliseconds(t);
  }
  /**
   * Set the timezone offset of the instance.
   * @param {string|number} tzValue - The name of timezone(IANA name) or timezone offset(in minutes).
   * @returns {TZDate} - New instance with the timezone offset.
   */
  tz(t) {
    if (t === "Local")
      return new O(this.getTime());
    const n = be(t) ? Vs(t, this) : t, r = new O(this.getTime() - wo(n));
    return r.tzOffset = n, r;
  }
  /**
   * Get the new instance following the system's timezone.
   * If the system timezone is different from the timezone of the instance,
   * the instance is converted to the system timezone.
   *
   * Instance's `tzOffset` property will be ignored if there is a `tzValue` parameter.
   *
   * @param {string|number} tzValue - The name of timezone(IANA name) or timezone offset(in minutes).
   * @returns {TZDate} - New instance with the system timezone.
   */
  local(t) {
    if (x(t)) {
      const n = be(t) ? Vs(t, this) : t;
      return new O(this.getTime() + wo(n));
    }
    return new O(
      this.getTime() + (x(this.tzOffset) ? wo(this.tzOffset) : 0)
    );
  }
}
function ud(e, ...t) {
  return t.reduce((n, r) => (e.hasOwnProperty(r) && (n[r] = e[r]), n), {});
}
function dd(e) {
  return Object.assign(Object.create(Object.getPrototypeOf(e)), e);
}
function Ue(e, t = {}) {
  return vo(t) && Object.keys(t).forEach((n) => {
    const r = n, o = n;
    !Array.isArray(t[o]) && vo(e[r]) && vo(t[o]) && !(t[o] instanceof O) ? e[r] = Ue(
      e[r],
      t[o]
    ) : e[r] = t[o];
  }), e;
}
const fd = [
  "top",
  "left",
  "width",
  "height",
  "exceedLeft",
  "exceedRight",
  "croppedStart",
  "croppedEnd",
  "goingDurationHeight",
  "modelDurationHeight",
  "comingDurationHeight",
  "duplicateEvents",
  "duplicateEventIndex",
  "duplicateStarts",
  "duplicateEnds",
  "duplicateLeft",
  "duplicateWidth",
  "collapse",
  "isMain"
];
class bt {
  constructor(t) {
    this.top = 0, this.left = 0, this.width = 0, this.height = 0, this.exceedLeft = !1, this.exceedRight = !1, this.croppedStart = !1, this.croppedEnd = !1, this.goingDurationHeight = 0, this.modelDurationHeight = 100, this.comingDurationHeight = 0, this.duplicateEvents = [], this.duplicateEventIndex = -1, this.duplicateLeft = "", this.duplicateWidth = "", this.collapse = !1, this.isMain = !1, this.model = t;
  }
  getUIProps() {
    return ud(this, ...fd);
  }
  setUIProps(t) {
    Object.assign(this, t);
  }
  /**
   * return renderStarts property to render properly when specific event that exceed rendering date range.
   *
   * if renderStarts is not set. return model's start property.
   */
  getStarts() {
    return this.renderStarts ? this.renderStarts : this.model.getStarts();
  }
  /**
   * return renderStarts property to render properly when specific event that exceed rendering date range.
   *
   * if renderEnds is not set. return model's end property.
   */
  getEnds() {
    return this.renderEnds ? this.renderEnds : this.model.getEnds();
  }
  /**
   * @returns {number} unique number for model.
   */
  cid() {
    return this.model.cid();
  }
  /**
   * Shadowing valueOf method for event sorting.
   */
  valueOf() {
    return this.model;
  }
  /**
   * Link duration method
   * @returns {number} EventModel#duration result.
   */
  duration() {
    return this.model.duration();
  }
  collidesWith(t, n = !0) {
    const r = [];
    [this, t].forEach((s) => {
      s instanceof bt && s.duplicateEvents.length > 0 ? r.push({
        start: s.duplicateStarts,
        end: s.duplicateEnds,
        goingDuration: 0,
        comingDuration: 0
      }) : r.push({
        start: s.getStarts(),
        end: s.getEnds(),
        goingDuration: s.valueOf().goingDuration,
        comingDuration: s.valueOf().comingDuration
      });
    });
    const [o, i] = r;
    return fc({
      start: o.start.getTime(),
      end: o.end.getTime(),
      targetStart: i.start.getTime(),
      targetEnd: i.end.getTime(),
      goingDuration: o.goingDuration,
      comingDuration: o.comingDuration,
      targetGoingDuration: i.goingDuration,
      targetComingDuration: i.comingDuration,
      usingTravelTime: n
      // Daygrid does not use travelTime, TimeGrid uses travelTime.
    });
  }
  clone() {
    const t = this.getUIProps(), n = new bt(this.model);
    return n.setUIProps(t), this.renderStarts && (n.renderStarts = new O(this.renderStarts)), this.renderEnds && (n.renderEnds = new O(this.renderEnds)), n;
  }
}
function pd(e, t) {
  return e !== t ? e ? -1 : 1 : 0;
}
function hd(e, t) {
  const n = e instanceof bt ? e.model : e, r = t instanceof bt ? t.model : t, o = pd(
    n.isAllday || n.hasMultiDates,
    r.isAllday || r.hasMultiDates
  );
  if (o)
    return o;
  const i = gt(e.getStarts(), t.getStarts());
  if (i)
    return i;
  const s = e.duration(), c = t.duration();
  return s < c ? 1 : s > c ? -1 : n.cid() - r.cid();
}
const Ct = {
  compare: {
    event: {
      asc: hd
    }
  }
};
function jo(e) {
  return e[0];
}
function rt(e) {
  return e[e.length - 1];
}
function _i(e, t) {
  for (let n = e.length - 1; n >= 0; n -= 1)
    if (t(e[n]))
      return n;
  return -1;
}
function qs(e, t) {
  return e > 0 ? Array.from({ length: e }, () => Array.isArray(t) ? t.slice() : t) : [];
}
var rn = /* @__PURE__ */ ((e) => (e[e.SUN = 0] = "SUN", e[e.MON = 1] = "MON", e[e.TUE = 2] = "TUE", e[e.WED = 3] = "WED", e[e.THU = 4] = "THU", e[e.FRI = 5] = "FRI", e[e.SAT = 6] = "SAT", e))(rn || {});
const Ve = 7, md = /^(\d{4}[-|/]*\d{2}[-|/]*\d{2})\s?(\d{2}:\d{2}:\d{2})?$/, gd = {
  millisecondsFrom: {}
}, vd = [24, 60, 60, 1e3];
function Ne(e, t) {
  let n = "", r = 0;
  if (String(e).length > t)
    return String(e);
  for (; r < t - 1; r += 1)
    n += "0";
  return (n + e).slice(t * -1);
}
function Xs(e) {
  let t = e.getHours();
  return t === 0 && (t = 12), t > 12 && (t = t % 12), t;
}
const _d = {
  YYYYMMDD(e) {
    return [
      e.getFullYear(),
      Ne(e.getMonth() + 1, 2),
      Ne(e.getDate(), 2)
    ].join("");
  },
  YYYY(e) {
    return String(e.getFullYear());
  },
  MM(e) {
    return Ne(e.getMonth() + 1, 2);
  },
  DD(e) {
    return Ne(e.getDate(), 2);
  },
  "HH:mm": function(e) {
    const t = e.getHours(), n = e.getMinutes();
    return `${Ne(t, 2)}:${Ne(n, 2)}`;
  },
  "hh:mm": function(e) {
    const t = Xs(e), n = e.getMinutes();
    return `${Ne(t, 2)}:${Ne(n, 2)}`;
  },
  hh(e) {
    const t = Xs(e);
    return String(t);
  },
  tt(e) {
    return e.getHours() < 12 ? "am" : "pm";
  }
}, ot = 864e5, yi = 6e4, Vn = 20 * yi, lc = 1800 * 1e3;
function fe(e, t) {
  let n = t;
  return Object.entries(_d).forEach(([r, o]) => {
    n = n.replace(r, o(e));
  }), n;
}
function yd(e, t, n) {
  const r = {
    date: 0,
    hour: 1,
    minute: 2,
    second: 3
  };
  return !(e in r) || isNaN(t) ? 0 : [t].concat(vd.slice(r[e])).reduce(n);
}
function jn(e, t) {
  const n = gd.millisecondsFrom, r = e + t;
  if (n[r])
    return n[r];
  const o = yd(e, t, (i, s) => i * s);
  return o ? (n[r] = o, n[r]) : 0;
}
function pe(e) {
  const t = e ? new O(e) : new O();
  return t.setHours(0, 0, 0, 0), t;
}
function qo(e, t, n) {
  const r = e.getTime(), o = t.getTime(), i = new O(e), s = [];
  let c = r;
  for (; c <= o && o >= i.getTime(); )
    s.push(new O(i)), c = c + n, i.addMilliseconds(n);
  return s;
}
function on(e) {
  return new O(e);
}
function gt(e, t) {
  const n = e.getTime(), r = t.getTime();
  return n < r ? -1 : n > r ? 1 : 0;
}
function wd(e, t) {
  return e.getFullYear() === t.getFullYear();
}
function Ed(e, t) {
  return wd(e, t) && e.getMonth() === t.getMonth();
}
function kt(e, t) {
  return Ed(e, t) && e.getDate() === t.getDate();
}
function wi(e, t) {
  return gt(e, t) === 1 ? e : t;
}
function uc(e, t) {
  return gt(e, t) === -1 ? e : t;
}
function Ks(e, t = -1) {
  const n = e.match(md);
  let r, o, i;
  if (!n)
    throw new Qu(e);
  if (e.length > 8) {
    r = ~e.indexOf("/") ? "/" : "-";
    const s = n.splice(1);
    o = s[0].split(r), i = s[1] ? s[1].split(":") : [0, 0, 0];
  } else {
    const [s] = n;
    o = [s.substr(0, 4), s.substr(4, 2), s.substr(6, 2)], i = [0, 0, 0];
  }
  return new O().setWithRaw(
    Number(o[0]),
    Number(o[1]) + t,
    Number(o[2]),
    Number(i[0]),
    Number(i[1]),
    Number(i[2]),
    0
  );
}
function Ae(e) {
  const t = e ? new O(e) : new O();
  return t.setHours(23, 59, 59, 999), t;
}
function $e(e) {
  return e === 0 || e === 6;
}
function Ei(e) {
  return e === 0;
}
function Di(e) {
  return e === 6;
}
function dc(e) {
  const t = new O(e);
  return t.setDate(1), t.setHours(0, 0, 0, 0), t;
}
function Dd(e) {
  const t = dc(e);
  return t.setMonth(t.getMonth() + 1), t.setDate(t.getDate() - 1), t.setHours(23, 59, 59, 999), t;
}
function Si(e, t, n, r) {
  const i = 100 / e, s = e > 5 ? 100 / (e - 1) : i;
  let c = 0;
  const u = mt(n, Ve).concat(mt(e)).slice(0, Ve);
  t = r ? !1 : t;
  const l = u.map((p) => {
    let h = t ? s : i;
    e > 5 && t && $e(p) && (h = s / 2);
    const m = {
      width: h,
      left: c
    };
    return c += h, m;
  }), { length: a } = l, d = qs(a, qs(a, 0));
  return l.forEach(({ width: p }, h) => {
    for (let m = 0; m <= h; m += 1)
      for (let w = h; w < a; w += 1)
        d[m][w] += p;
  }), d[0][a - 1] = 100, {
    rowStyleInfo: l,
    cellWidthMap: d.map((p) => p.map(q))
  };
}
function yr(e, t) {
  const n = on(e);
  return n.setMilliseconds(e.getMilliseconds() + t), n;
}
function Ie(e, t) {
  const n = on(e);
  return n.setMinutes(e.getMinutes() + t), n;
}
function je(e, t) {
  const n = on(e);
  return n.setHours(...t.split(":").map(Number)), n;
}
function Nt(e, t) {
  const n = on(e);
  return n.setDate(e.getDate() + t), n;
}
function Sd(e, t) {
  const n = on(e);
  return n.setDate(e.getDate() - t), n;
}
function Td(e, t = 1) {
  const n = on(e);
  if (t !== 0) {
    const r = n.getDate(), o = new O(n.getTime());
    o.setMonth(n.getMonth() + t + 1, 0);
    const i = o.getDate();
    if (r >= i)
      return o;
    n.setFullYear(o.getFullYear(), o.getMonth(), r);
  }
  return n;
}
function Ti(e, t) {
  const n = new O(e.getFullYear(), e.getMonth(), e.getDate()).getTime(), r = new O(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((n - r) / ot);
}
function bd(e, t, n, r) {
  return n > e && n < t || r > e && r < t || n <= e && r >= t;
}
function fc({
  start: e,
  end: t,
  targetStart: n,
  targetEnd: r,
  goingDuration: o,
  comingDuration: i,
  targetGoingDuration: s,
  targetComingDuration: c,
  usingTravelTime: u
}) {
  return Math.abs(t - e) < Vn && (t += Vn), Math.abs(t - e) < Vn && (t += Vn), u && (e -= jn("minute", o), t += jn("minute", i), n -= jn("minute", s), r += jn("minute", c)), bd(e, t, n, r);
}
function Cd(e, t, n) {
  return e.id === t && e.calendarId === n;
}
function kd() {
  let e = 0;
  return {
    next() {
      return e += 1, e;
    }
  };
}
const Nd = (function() {
  const e = kd();
  return () => e.next();
})();
function Zs(e) {
  return e.__fe_id || (e.__fe_id = Nd()), e.__fe_id;
}
const zi = class zi {
  constructor(t = {}) {
    this.id = "", this.calendarId = "", this.title = "", this.body = "", this.isAllday = !1, this.start = new O(), this.end = new O(), this.goingDuration = 0, this.comingDuration = 0, this.location = "", this.attendees = [], this.category = "time", this.dueDateClass = "", this.recurrenceRule = "", this.state = "Busy", this.isVisible = !0, this.isPending = !1, this.isFocused = !1, this.isReadOnly = !1, this.isPrivate = !1, this.customStyle = {}, this.raw = null, this.hasMultiDates = !1, Zs(this), this.init(t);
  }
  init({
    id: t = "",
    calendarId: n = "",
    title: r = "",
    body: o = "",
    isAllday: i = !1,
    start: s = new O(),
    end: c = new O(),
    goingDuration: u = 0,
    comingDuration: l = 0,
    location: a = "",
    attendees: d = [],
    category: p = "time",
    dueDateClass: h = "",
    recurrenceRule: m = "",
    state: w = "Busy",
    isVisible: y = !0,
    isPending: v = !1,
    isFocused: E = !1,
    isReadOnly: T = !1,
    isPrivate: k = !1,
    color: D,
    backgroundColor: N,
    dragBackgroundColor: M,
    borderColor: H,
    customStyle: $ = {},
    raw: Y = null
  } = {}) {
    this.id = t, this.calendarId = n, this.title = r, this.body = o, this.isAllday = p === "allday" ? !0 : i, this.goingDuration = u, this.comingDuration = l, this.location = a, this.attendees = d, this.category = p, this.dueDateClass = h, this.recurrenceRule = m, this.state = w, this.isVisible = y, this.isPending = v, this.isFocused = E, this.isReadOnly = T, this.isPrivate = k, this.color = D, this.backgroundColor = N, this.dragBackgroundColor = M, this.borderColor = H, this.customStyle = $, this.raw = Y, this.isAllday ? this.setAlldayPeriod(s, c) : this.setTimePeriod(s, c), (p === "milestone" || p === "task") && (this.start = new O(this.end));
  }
  setAlldayPeriod(t, n) {
    let r, o;
    be(t) ? r = Ks(t.substring(0, 10)) : r = new O(t || Date.now()), be(n) ? o = Ks(n.substring(0, 10)) : o = new O(n || this.start), this.start = r, this.start.setHours(0, 0, 0), this.end = o || new O(this.start), this.end.setHours(23, 59, 59);
  }
  setTimePeriod(t, n) {
    this.start = new O(t || Date.now()), this.end = new O(n || this.start), n || this.end.setMinutes(this.end.getMinutes() + 30), this.hasMultiDates = this.end.getTime() - this.start.getTime() > ot;
  }
  /**
   * @returns {TZDate} render start date.
   */
  getStarts() {
    return this.start;
  }
  /**
   * @returns {TZDate} render end date.
   */
  getEnds() {
    return this.end;
  }
  /**
   * @returns {number} instance unique id.
   */
  cid() {
    return Zs(this);
  }
  /**
   * Check two  are equals (means title, isAllday, start, end are same)
   * @param {EventModel}  event model instance to compare.
   * @returns {boolean} Return false when not same.
   */
  // eslint-disable-next-line complexity
  equals(t) {
    return !(this.id !== t.id || this.title !== t.title || this.body !== t.body || this.isAllday !== t.isAllday || gt(this.getStarts(), t.getStarts()) !== 0 || gt(this.getEnds(), t.getEnds()) !== 0 || this.color !== t.color || this.backgroundColor !== t.backgroundColor || this.dragBackgroundColor !== t.dragBackgroundColor || this.borderColor !== t.borderColor);
  }
  /**
   * return duration between start and end.
   * @returns {number} duration milliseconds (UTC)
   */
  duration() {
    const t = Number(this.getStarts()), n = Number(this.getEnds());
    let r;
    return this.isAllday ? r = Number(Ae(n)) - Number(pe(t)) : r = n - t, r;
  }
  valueOf() {
    return this;
  }
  /**
   * Returns true if the given EventModel coincides with the same time as the
   * calling EventModel.
   * @param {EventModel | EventUIModel} event The other event to compare with this EventModel.
   * @param {boolean = true} usingTravelTime When calculating collision, whether to calculate with travel time.
   * @returns {boolean} If the other event occurs within the same time as the first object.
   */
  collidesWith(t, n = !0) {
    return t = t instanceof bt ? t.model : t, fc({
      start: Number(this.getStarts()),
      end: Number(this.getEnds()),
      targetStart: Number(t.getStarts()),
      targetEnd: Number(t.getEnds()),
      goingDuration: this.goingDuration,
      comingDuration: this.comingDuration,
      targetGoingDuration: t.goingDuration,
      targetComingDuration: t.comingDuration,
      usingTravelTime: n
      // Daygrid does not use travelTime, TimeGrid uses travelTime.
    });
  }
  toEventObject() {
    return {
      id: this.id,
      calendarId: this.calendarId,
      __cid: this.cid(),
      title: this.title,
      body: this.body,
      isAllday: this.isAllday,
      start: this.start,
      end: this.end,
      goingDuration: this.goingDuration,
      comingDuration: this.comingDuration,
      location: this.location,
      attendees: this.attendees,
      category: this.category,
      dueDateClass: this.dueDateClass,
      recurrenceRule: this.recurrenceRule,
      state: this.state,
      isVisible: this.isVisible,
      isPending: this.isPending,
      isFocused: this.isFocused,
      isReadOnly: this.isReadOnly,
      isPrivate: this.isPrivate,
      color: this.color,
      backgroundColor: this.backgroundColor,
      dragBackgroundColor: this.dragBackgroundColor,
      borderColor: this.borderColor,
      customStyle: this.customStyle,
      raw: this.raw
    };
  }
  getColors() {
    return {
      color: this.color,
      backgroundColor: this.backgroundColor,
      dragBackgroundColor: this.dragBackgroundColor,
      borderColor: this.borderColor
    };
  }
};
zi.schema = {
  required: ["title"],
  dateRange: ["start", "end"]
};
let wr = zi;
function Id({ model: e }) {
  const { category: t, isAllday: n, hasMultiDates: r } = e;
  return t === "time" && !n && !r;
}
class Xe {
  constructor(t) {
    this.internalMap = /* @__PURE__ */ new Map(), bn(t) && (this.getItemID = t);
  }
  /**
   * Combine supplied function filters and condition.
   * @param {...Filter} filterFns - function filters
   * @returns {function} combined filter
   */
  static and(...t) {
    const { length: n } = t;
    return (r) => {
      for (let o = 0; o < n; o += 1)
        if (!t[o].call(null, r))
          return !1;
      return !0;
    };
  }
  /**
   * Combine multiple function filters with OR clause.
   * @param {...function} filterFns - function filters
   * @returns {function} combined filter
   */
  static or(...t) {
    const { length: n } = t;
    return n ? (r) => {
      let o = t[0].call(null, r);
      for (let i = 1; i < n; i += 1)
        o = o || t[i].call(null, r);
      return o;
    } : () => !1;
  }
  /**
   * get model's unique id.
   * @param {object} item model instance.
   * @returns {string | number} model unique id.
   */
  getItemID(t) {
    var n;
    return (n = t == null ? void 0 : t._id) != null ? n : "";
  }
  getFirstItem() {
    return this.internalMap.values().next().value;
  }
  /**
   * add models.
   * @param {Object[]} items - models to add this collection.
   */
  add(...t) {
    return t.forEach((n) => {
      const r = this.getItemID(n);
      this.internalMap.set(r, n);
    }), this;
  }
  /**
   * remove models.
   * @param {Array.<(Object|string|number)>} items model instances or unique ids to delete.
   */
  remove(...t) {
    const n = [];
    return t.forEach((r) => {
      const o = be(r) || ar(r) ? r : this.getItemID(r);
      this.internalMap.has(o) && (n.push(this.internalMap.get(o)), this.internalMap.delete(o));
    }), n.length === 1 ? n[0] : n;
  }
  /**
   * check collection has specific model.
   * @param {(object|string|number)} id model instance or id to check
   * @returns {boolean} is has model?
   */
  has(t) {
    const n = be(t) || ar(t) ? t : this.getItemID(t);
    return this.internalMap.has(n);
  }
  get(t) {
    var r;
    const n = be(t) || ar(t) ? t : this.getItemID(t);
    return (r = this.internalMap.get(n)) != null ? r : null;
  }
  /**
   * invoke callback when model exist in collection.
   * @param {(string|number)} id model unique id.
   * @param {function} callback the callback.
   */
  doWhenHas(t, n) {
    const r = this.internalMap.get(t);
    z(r) || n(r);
  }
  /**
   * Search model. and return new collection.
   * @param {function} filterFn filter function.
   * @returns {Collection} new collection with filtered models.
   * @example
   * collection.filter(function(item) {
   *     return item.edited === true;
   * });
   *
   * function filter1(item) {
   *     return item.edited === false;
   * }
   *
   * function filter2(item) {
   *     return item.disabled === false;
   * }
   *
   * collection.filter(Collection.and(filter1, filter2));
   *
   * collection.filter(Collection.or(filter1, filter2));
   */
  filter(t) {
    const n = new Xe();
    return this.hasOwnProperty("getItemID") && (n.getItemID = this.getItemID), this.internalMap.forEach((r) => {
      t(r) === !0 && n.add(r);
    }), n;
  }
  /**
   * Group element by specific key values.
   *
   * if key parameter is function then invoke it and use returned value.
   * @param {(string|number|function)} groupByFn key property or getter function.
   * @returns {object.<string|number, Collection>} grouped object
   * @example
   * // pass `string`, `number`, `boolean` type value then group by property value.
   * collection.groupBy('gender');    // group by 'gender' property value.
   * collection.groupBy(50);          // group by '50' property value.
   *
   * // pass `function` then group by return value. each invocation `function` is called with `(item)`.
   * collection.groupBy(function(item) {
   *     if (item.score > 60) {
   *         return 'pass';
   *     }
   *     return 'fail';
   * });
   */
  groupBy(t) {
    const n = {};
    return this.internalMap.forEach((r) => {
      var i;
      let o = bn(t) ? t(r) : r[t];
      bn(o) && (o = o.call(r)), (i = n[o]) != null || (n[o] = new Xe(this.getItemID)), n[o].add(r);
    }), n;
  }
  /**
   * Return the first item in collection that satisfies the provided function.
   * @param {function} [findFn] - function filter
   * @returns {object|null} item.
   */
  find(t) {
    let n = null;
    const r = this.internalMap.values();
    let o = r.next();
    for (; o.done === !1; ) {
      if (t(o.value)) {
        n = o.value;
        break;
      }
      o = r.next();
    }
    return n;
  }
  /**
   * sort a basis of supplied compare function.
   * @param {function} compareFn compareFunction
   * @returns {array} sorted array.
   */
  sort(t) {
    return this.toArray().sort(t);
  }
  /**
   * iterate each model element.
   *
   * when iteratee return false then break the loop.
   * @param {function} iteratee iteratee(item, index, items)
   */
  each(t) {
    const n = this.internalMap.entries();
    let r = n.next();
    for (; r.done === !1; ) {
      const [o, i] = r.value;
      if (t(i, o) === !1)
        break;
      r = n.next();
    }
  }
  /**
   * remove all models in collection.
   */
  clear() {
    this.internalMap.clear();
  }
  /**
   * return new array with collection items.
   * @returns {array} new array.
   */
  toArray() {
    return Array.from(this.internalMap.values());
  }
  get size() {
    return this.internalMap.size;
  }
}
function Jt(...e) {
  const t = new Xe((n) => n.cid());
  return e.length && t.add(...e), t;
}
function pc(e, t) {
  return qo(pe(e), Ae(t), ot);
}
function Md(e) {
  return e.isAllday || e.category === "time" && Number(e.end) - Number(e.start) > ot;
}
function Ad(e) {
  const { model: t } = e;
  return Md(t) ? "allday" : t.category;
}
function hc(e, t) {
  pc(t.getStarts(), t.getEnds()).forEach((r) => {
    const o = fe(r, "YYYYMMDD");
    (e[o] = e[o] || []).push(t.cid());
  });
}
function mc(e, t) {
  const n = t.cid();
  Object.values(e).forEach((r) => {
    const o = r.indexOf(n);
    ~o && r.splice(o, 1);
  });
}
function Rd(e, t) {
  return e.events.add(t), hc(e.idsOfDay, t), t;
}
function xd(e, t) {
  const n = new wr(t);
  return Rd(e, n);
}
function Od(e, t = []) {
  return t.map((n) => xd(e, n));
}
function Pd(e, t, n, r) {
  const { idsOfDay: o } = e, i = e.events.find((s) => Cd(s, t, n));
  return i ? (i.init(R(R({}, i), r)), mc(o, i), hc(o, i), !0) : !1;
}
function Ld(e, t) {
  return mc(e.idsOfDay, t), e.events.remove(t), t;
}
function Hd(e) {
  e.idsOfDay = {}, e.events.clear();
}
function $d(e = []) {
  return {
    calendar: {
      calendars: e,
      events: Jt(),
      idsOfDay: {}
    }
  };
}
function Bd(e) {
  return {
    createEvents: (t) => e(
      Z((n) => {
        Od(n.calendar, t);
      })
    ),
    updateEvent: ({ event: t, eventData: n }) => e(
      Z((r) => {
        Pd(
          r.calendar,
          t.id,
          t.calendarId,
          n
        );
      })
    ),
    deleteEvent: (t) => e(
      Z((n) => {
        Ld(n.calendar, t);
      })
    ),
    clearEvents: () => e(
      Z((t) => {
        Hd(t.calendar);
      })
    ),
    setCalendars: (t) => e(
      Z((n) => {
        n.calendar.calendars = t;
      })
    ),
    setCalendarColor: (t, n) => e(
      Z((r) => {
        const o = r.calendar.calendars.map((c) => c.id === t ? R(R({}, c), n) : c), i = r.calendar.events.toArray().map((c) => {
          var u, l, a, d;
          return c.calendarId === t && (c.color = (u = n.color) != null ? u : c.color, c.backgroundColor = (l = n.backgroundColor) != null ? l : c.backgroundColor, c.borderColor = (a = n.borderColor) != null ? a : c.borderColor, c.dragBackgroundColor = (d = n.dragBackgroundColor) != null ? d : c.dragBackgroundColor), c;
        }), s = Jt(...i);
        r.calendar.calendars = o, r.calendar.events = s;
      })
    ),
    setCalendarVisibility: (t, n) => e(
      Z((r) => {
        const o = r.calendar.events.toArray();
        r.calendar.events = Jt(
          ...o.map((i) => (t.includes(i.calendarId) && (i.isVisible = n), i))
        );
      })
    )
  };
}
var ze = /* @__PURE__ */ ((e) => (e[e.IDLE = 0] = "IDLE", e[e.INIT = 1] = "INIT", e[e.DRAGGING = 2] = "DRAGGING", e[e.CANCELED = 3] = "CANCELED", e))(ze || {});
function Xo() {
  return {
    dnd: {
      draggingItemType: null,
      draggingState: 0,
      initX: null,
      initY: null,
      x: null,
      y: null,
      draggingEventUIModel: null
    }
  };
}
function Fd(e) {
  return {
    initDrag: (t) => {
      e(
        Z((n) => {
          n.dnd = ae(R(R({}, n.dnd), t), {
            draggingState: 1
            /* INIT */
          });
        })
      );
    },
    setDragging: (t) => {
      e(
        Z((n) => {
          n.dnd = ae(R(R({}, n.dnd), t), {
            draggingState: 2
            /* DRAGGING */
          });
        })
      );
    },
    cancelDrag: () => {
      e(
        Z((t) => {
          t.dnd = Xo().dnd, t.dnd.draggingState = 3;
        })
      );
    },
    reset: () => {
      e(
        Z((t) => {
          t.dnd = Xo().dnd;
        })
      );
    },
    setDraggingEventUIModel: (t) => {
      e(
        Z((n) => {
          var r;
          n.dnd.draggingEventUIModel = (r = t == null ? void 0 : t.clone()) != null ? r : null;
        })
      );
    }
  };
}
function gc() {
  return {
    gridSelection: {
      dayGridMonth: null,
      dayGridWeek: null,
      timeGrid: null,
      accumulated: {
        dayGridMonth: []
      }
    }
  };
}
function Gd(e) {
  return {
    setGridSelection: (t, n) => {
      e(
        Z((r) => {
          r.gridSelection[t] = n;
        })
      );
    },
    addGridSelection: (t, n) => {
      e(
        Z((r) => {
          t === "dayGridMonth" && n && (r.gridSelection.accumulated[t] = [
            ...r.gridSelection.accumulated[t],
            n
          ], r.gridSelection.dayGridMonth = null);
        })
      );
    },
    clearAll: () => e(
      Z((t) => {
        t.gridSelection = gc().gridSelection;
      })
    )
  };
}
const Ko = 3, Rr = -1;
function qn(e, t, n) {
  return Object.keys(e).reduce((r, o) => o === t ? r : r - e[o].height - Ko, n);
}
function Ud() {
  return {
    layout: 500,
    weekViewLayout: {
      lastPanelType: null,
      dayGridRows: {},
      selectedDuplicateEventCid: Rr
    }
  };
}
function zd(e) {
  return {
    setLastPanelType: (t) => {
      e(
        Z((n) => {
          n.weekViewLayout.lastPanelType = t, t && (n.weekViewLayout.dayGridRows[t].height = qn(
            n.weekViewLayout.dayGridRows,
            t,
            n.layout
          ));
        })
      );
    },
    updateLayoutHeight: (t) => e(
      Z((n) => {
        const { lastPanelType: r } = n.weekViewLayout;
        n.layout = t, r && (n.weekViewLayout.dayGridRows[r].height = qn(
          n.weekViewLayout.dayGridRows,
          r,
          t
        ));
      })
    ),
    updateDayGridRowHeight: ({ rowName: t, height: n }) => e(
      Z((r) => {
        const { lastPanelType: o } = r.weekViewLayout;
        r.weekViewLayout.dayGridRows[t] = { height: n }, o && (r.weekViewLayout.dayGridRows[o].height = qn(
          r.weekViewLayout.dayGridRows,
          o,
          r.layout
        ));
      })
    ),
    updateDayGridRowHeightByDiff: ({ rowName: t, diff: n }) => e(
      Z((r) => {
        var s, c, u;
        const { lastPanelType: o } = r.weekViewLayout, i = (u = (c = (s = r.weekViewLayout.dayGridRows) == null ? void 0 : s[t]) == null ? void 0 : c.height) != null ? u : Zt;
        r.weekViewLayout.dayGridRows[t] = { height: i + n }, o && (r.weekViewLayout.dayGridRows[o].height = qn(
          r.weekViewLayout.dayGridRows,
          o,
          r.layout
        ));
      })
    ),
    setSelectedDuplicateEventCid: (t) => e(
      Z((n) => {
        n.weekViewLayout.selectedDuplicateEventCid = t != null ? t : Rr;
      })
    )
  };
}
function xr(e) {
  return e.charAt(0).toUpperCase() + e.slice(1);
}
const vc = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"], Er = (e) => vc[e];
function _c(e, t) {
  return e.map((n) => {
    const r = n.getDay(), o = t.length > 0 ? t[r] : xr(Er(r));
    return {
      date: n.getDate(),
      day: n.getDay(),
      dayName: o,
      isToday: !0,
      renderDate: "date",
      dateInstance: n
    };
  });
}
function yc(e) {
  if (!e)
    return !1;
  const t = {
    getDuplicateEvents: (n, r) => r.filter(
      (o) => o.title === n.title && gt(o.start, n.start) === 0 && gt(o.end, n.end) === 0
    ).sort((o, i) => o.calendarId > i.calendarId ? 1 : -1),
    getMainEvent: (n) => rt(n)
  };
  return vi(e) ? t : R(R({}, t), e);
}
function Wd(e = {}) {
  const t = R({
    startDayOfWeek: rn.SUN,
    dayNames: [],
    narrowWeekend: !1,
    workweek: !1,
    showNowIndicator: !0,
    showTimezoneCollapseButton: !1,
    timezonesCollapsed: !1,
    hourStart: 0,
    hourEnd: 24,
    eventView: !0,
    taskView: !0,
    collapseDuplicateEvents: !1
  }, e);
  return t.collapseDuplicateEvents = yc(t.collapseDuplicateEvents), t;
}
function Yd(e = {}) {
  return R({
    zones: []
  }, e);
}
function Vd(e = {}) {
  const t = R({
    dayNames: [],
    visibleWeeksCount: 0,
    workweek: !1,
    narrowWeekend: !1,
    startDayOfWeek: rn.SUN,
    isAlways6Weeks: !0,
    visibleEventCount: 6
  }, e);
  return t.dayNames.length === 0 && (t.dayNames = vc.slice()), t;
}
function wc(e) {
  return vi(e) ? {
    enableDblClick: e,
    enableClick: e
  } : R({
    enableDblClick: !0,
    enableClick: !0
  }, e);
}
const jd = (e) => !!e.isVisible;
function qd(e = {}) {
  var t, n, r, o, i, s;
  return {
    options: {
      defaultView: (t = e.defaultView) != null ? t : "week",
      useFormPopup: (n = e.useFormPopup) != null ? n : !1,
      useDetailPopup: (r = e.useDetailPopup) != null ? r : !1,
      isReadOnly: (o = e.isReadOnly) != null ? o : !1,
      week: Wd(e.week),
      month: Vd(e.month),
      gridSelection: wc(e.gridSelection),
      usageStatistics: (i = e.usageStatistics) != null ? i : !0,
      eventFilter: (s = e.eventFilter) != null ? s : jd,
      timezone: Yd(e.timezone)
    }
  };
}
function Xd(e) {
  return {
    setOptions: (t = {}) => e(
      Z((n) => {
        var r;
        t.gridSelection && (t.gridSelection = wc(t.gridSelection)), (r = t.week) != null && r.collapseDuplicateEvents && (t.week.collapseDuplicateEvents = yc(
          t.week.collapseDuplicateEvents
        )), Ue(n.options, t);
      })
    )
  };
}
var Or = /* @__PURE__ */ ((e) => (e.SeeMore = "seeMore", e.Form = "form", e.Detail = "detail", e))(Or || {});
function Kd() {
  return {
    popup: {
      seeMore: null,
      form: null,
      detail: null
    }
  };
}
function Zd(e) {
  return {
    showSeeMorePopup: (t) => e(
      Z((n) => {
        n.popup.seeMore = t, n.popup.form = null, n.popup.detail = null;
      })
    ),
    showFormPopup: (t) => e(
      Z((n) => {
        n.popup.form = t, n.popup.seeMore = null, n.popup.detail = null;
      })
    ),
    showDetailPopup: (t, n) => e(
      Z((r) => {
        r.popup.detail = t, r.popup.form = null, n || (r.popup.seeMore = null);
      })
    ),
    hideSeeMorePopup: () => e(
      Z((t) => {
        t.popup.seeMore = null;
      })
    ),
    hideFormPopup: () => e(
      Z((t) => {
        t.popup.form = null;
      })
    ),
    hideDetailPopup: () => e(
      Z((t) => {
        t.popup.detail = null;
      })
    ),
    hideAllPopup: () => e(
      Z((t) => {
        t.popup.seeMore = null, t.popup.form = null, t.popup.detail = null;
      })
    )
  };
}
const sn = () => {
}, Jd = /^auto$|^$|%/;
function Js(e, t) {
  let n = e.style[t];
  if ((!n || n === "auto") && document.defaultView) {
    const r = document.defaultView.getComputedStyle(e, null);
    n = r ? r[t] : null;
  }
  return n === "auto" ? null : n;
}
function Qs(e) {
  return be(e) ? Jd.test(e) : e === null;
}
function Ec(e) {
  const t = Js(e, "width"), n = Js(e, "height");
  if ((Qs(t) || Qs(n)) && e.getBoundingClientRect) {
    const { width: r, height: o } = e.getBoundingClientRect();
    return {
      width: r || e.offsetWidth,
      height: o || e.offsetHeight
    };
  }
  return {
    width: parseFloat(t != null ? t : "0"),
    height: parseFloat(n != null ? n : "0")
  };
}
const Qd = typeof Element == "undefined" ? sn : Element, Eo = Qd.prototype;
Eo.matches || Eo.webkitMatchesSelector || Eo.msMatchesSelector;
function Xn(e) {
  return e.replace(/<([^>]+)>/gi, "");
}
const Ut = 60, ef = {
  milestone(e) {
    const t = _("icon", "ic-milestone");
    return /* @__PURE__ */ f(Me, { children: [
      /* @__PURE__ */ f("span", { className: t }),
      /* @__PURE__ */ f(
        "span",
        {
          style: {
            backgroundColor: e.backgroundColor
          },
          children: Xn(e.title)
        }
      )
    ] });
  },
  milestoneTitle() {
    return /* @__PURE__ */ f("span", { className: _("left-content"), children: "Milestone" });
  },
  task(e) {
    return `#${e.title}`;
  },
  taskTitle() {
    return /* @__PURE__ */ f("span", { className: _("left-content"), children: "Task" });
  },
  alldayTitle() {
    return /* @__PURE__ */ f("span", { className: _("left-content"), children: "All Day" });
  },
  allday(e) {
    return Xn(e.title);
  },
  time(e) {
    const { start: t, title: n } = e;
    return t ? /* @__PURE__ */ f("span", { children: [
      /* @__PURE__ */ f("strong", { children: fe(t, "HH:mm") }),
      " ",
      /* @__PURE__ */ f("span", { children: Xn(n) })
    ] }) : Xn(n);
  },
  goingDuration(e) {
    const { goingDuration: t } = e, n = Math.floor(t / Ut), r = t % Ut;
    return `GoingTime ${Ne(n, 2)}:${Ne(r, 2)}`;
  },
  comingDuration(e) {
    const { comingDuration: t } = e, n = Math.floor(t / Ut), r = t % Ut;
    return `ComingTime ${Ne(n, 2)}:${Ne(r, 2)}`;
  },
  monthMoreTitleDate(e) {
    const { date: t, day: n } = e, r = _("more-title-date"), o = _("more-title-day"), i = xr(Er(n));
    return /* @__PURE__ */ f(Me, { children: [
      /* @__PURE__ */ f("span", { className: r, children: t }),
      /* @__PURE__ */ f("span", { className: o, children: i })
    ] });
  },
  monthMoreClose() {
    return "";
  },
  monthGridHeader(e) {
    const t = parseInt(e.date.split("-")[2], 10), n = _("weekday-grid-date", { "weekday-grid-date-decorator": e.isToday });
    return /* @__PURE__ */ f("span", { className: n, children: t });
  },
  monthGridHeaderExceed(e) {
    const t = _("weekday-grid-more-events");
    return /* @__PURE__ */ f("span", { className: t, children: [
      e,
      " more"
    ] });
  },
  monthGridFooter(e) {
    return "";
  },
  monthGridFooterExceed(e) {
    return "";
  },
  monthDayName(e) {
    return e.label;
  },
  weekDayName(e) {
    const t = _("day-name__date"), n = _("day-name__name");
    return /* @__PURE__ */ f(Me, { children: [
      /* @__PURE__ */ f("span", { className: t, children: e.date }),
      "  ",
      /* @__PURE__ */ f("span", { className: n, children: e.dayName })
    ] });
  },
  weekGridFooterExceed(e) {
    return `+${e}`;
  },
  collapseBtnTitle() {
    const e = _("collapse-btn-icon");
    return /* @__PURE__ */ f("span", { className: e });
  },
  timezoneDisplayLabel({ displayLabel: e, timezoneOffset: t }) {
    if (z(e) && x(t)) {
      const n = t < 0 ? "-" : "+", r = Math.abs(t / Ut), o = Math.abs(t % Ut);
      return `GMT${n}${Ne(r, 2)}:${Ne(o, 2)}`;
    }
    return e;
  },
  timegridDisplayPrimaryTime(e) {
    const { time: t } = e;
    return fe(t, "hh tt");
  },
  timegridDisplayTime(e) {
    const { time: t } = e;
    return fe(t, "HH:mm");
  },
  timegridNowIndicatorLabel(e) {
    const { time: t, format: n = "HH:mm" } = e;
    return fe(t, n);
  },
  popupIsAllday() {
    return "All day";
  },
  popupStateFree() {
    return "Free";
  },
  popupStateBusy() {
    return "Busy";
  },
  titlePlaceholder() {
    return "Subject";
  },
  locationPlaceholder() {
    return "Location";
  },
  startDatePlaceholder() {
    return "Start date";
  },
  endDatePlaceholder() {
    return "End date";
  },
  popupSave() {
    return "Save";
  },
  popupUpdate() {
    return "Update";
  },
  popupEdit() {
    return "Edit";
  },
  popupDelete() {
    return "Delete";
  },
  popupDetailTitle({ title: e }) {
    return e;
  },
  popupDetailDate({ isAllday: e, start: t, end: n }) {
    const r = "YYYY.MM.DD", o = "hh:mm tt", i = `${r} ${o}`, s = fe(t, e ? r : o), c = kt(t, n) ? o : i;
    return e ? `${s}${kt(t, n) ? "" : ` - ${fe(n, r)}`}` : `${fe(t, i)} - ${fe(n, c)}`;
  },
  popupDetailLocation({ location: e }) {
    return e;
  },
  popupDetailAttendees({ attendees: e = [] }) {
    return e.join(", ");
  },
  popupDetailState({ state: e }) {
    return e || "Busy";
  },
  popupDetailRecurrenceRule({ recurrenceRule: e }) {
    return e;
  },
  popupDetailBody({ body: e }) {
    return e;
  }
};
function tf(e = {}) {
  return {
    template: R(R({}, ef), e)
  };
}
function nf(e) {
  return {
    setTemplate: (t) => e(
      Z((n) => {
        n.template = R(R({}, n.template), t);
      })
    )
  };
}
function rf(e = "week") {
  const t = new O();
  return t.setHours(0, 0, 0, 0), {
    view: {
      currentView: e,
      renderDate: t
    }
  };
}
function of(e) {
  return {
    changeView: (t) => e(
      Z((n) => {
        n.view.currentView = t;
      })
    ),
    setRenderDate: (t) => e(
      Z((n) => {
        n.view.renderDate = pe(t);
      })
    )
  };
}
const sf = Ze(window) || !window.navigator, ea = sf ? re : ht;
function Dc() {
  const e = kr(null);
  function t({
    children: o,
    store: i
  }) {
    return pt(e.Provider, { value: i, children: o });
  }
  return {
    StoreProvider: t,
    useStore: (o, i = Object.is) => {
      const s = Nn(e);
      if (z(s))
        throw new Error("StoreProvider is not found");
      const [, c] = ai((E) => E + 1, 0), u = s.getState(), l = ee(u), a = ee(o), d = ee(i), p = ee(!1), h = ee();
      Ze(h.current) && (h.current = o(u));
      let m, w = !1;
      (l.current !== u || a.current !== o || d.current !== i || p.current) && (m = o(u), w = !i(h.current, m)), ea(() => {
        w && (h.current = m), l.current = u, a.current = o, d.current = i, p.current = !1;
      });
      const v = ee(u);
      return ea(() => {
        const E = () => {
          try {
            const k = s.getState(), D = a.current(k);
            !d.current(
              h.current,
              D
            ) && (l.current = k, h.current = m, c());
          } catch (k) {
            console.error("[toastui-calendar] failed to update state", k == null ? void 0 : k.message), p.current = !0, c();
          }
        }, T = s.subscribe(E);
        return s.getState() !== v.current && E(), T;
      }, []), w ? m : h.current;
    },
    useInternalStore: () => {
      const o = Nn(e);
      if (z(o))
        throw new Error("StoreProvider is not found");
      return U(() => o, [o]);
    }
  };
}
function Sc(e) {
  let t;
  const n = /* @__PURE__ */ new Set(), r = (u) => {
    const l = u(t);
    if (l !== t) {
      const a = t;
      t = R(R({}, t), l), n.forEach((d) => d(t, a));
    }
  }, o = () => t, c = { setState: r, getState: o, subscribe: (u, l, a) => {
    let d = u;
    if (l) {
      let p = l(t);
      const h = a != null ? a : Object.is;
      d = () => {
        const m = l(t);
        if (!h(p, m)) {
          const w = p;
          p = m, u(p, w);
        }
      };
    }
    return n.add(d), () => n.delete(d);
  }, clearListeners: () => n.clear() };
  return t = e(r, o, c), c;
}
const af = (e) => (t) => ae(R(R(R(R(R(R(R(R({}, qd(e)), tf(e.template)), Kd()), Ud()), $d(e.calendars)), rf(e.defaultView)), Xo()), gc()), {
  dispatch: {
    options: Xd(t),
    popup: Zd(t),
    weekViewLayout: zd(t),
    calendar: Bd(t),
    view: of(t),
    dnd: Fd(t),
    gridSelection: Gd(t),
    template: nf(t)
  }
}), cf = (e = {}) => Sc(af(e)), { StoreProvider: lf, useStore: G, useInternalStore: Tc } = Dc();
function _e(e) {
  return G(
    J(
      (t) => e ? t.dispatch[e] : t.dispatch,
      [e]
    )
  );
}
function _t(e) {
  return (t) => t[e];
}
const Pr = _t("calendar"), bc = _t(
  "weekViewLayout"
), Cc = _t("template"), an = _t("view"), We = _t("options"), Mt = _t("dnd");
var cr = { exports: {} };
var uf = cr.exports, ta;
function na() {
  return ta || (ta = 1, (function(e, t) {
    (function(n, r) {
      e.exports = r();
    })(uf, (function() {
      function n(I) {
        "@babel/helpers - typeof";
        return n = typeof Symbol == "function" && typeof Symbol.iterator == "symbol" ? function(A) {
          return typeof A;
        } : function(A) {
          return A && typeof Symbol == "function" && A.constructor === Symbol && A !== Symbol.prototype ? "symbol" : typeof A;
        }, n(I);
      }
      function r(I, A) {
        return r = Object.setPrototypeOf || function(K, ue) {
          return K.__proto__ = ue, K;
        }, r(I, A);
      }
      function o() {
        if (typeof Reflect == "undefined" || !Reflect.construct || Reflect.construct.sham) return !1;
        if (typeof Proxy == "function") return !0;
        try {
          return Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {
          })), !0;
        } catch (I) {
          return !1;
        }
      }
      function i(I, A, V) {
        return o() ? i = Reflect.construct : i = function(ue, Pt, lt) {
          var ut = [null];
          ut.push.apply(ut, Pt);
          var pn = Function.bind.apply(ue, ut), hn = new pn();
          return lt && r(hn, lt.prototype), hn;
        }, i.apply(null, arguments);
      }
      function s(I) {
        return c(I) || u(I) || l(I) || d();
      }
      function c(I) {
        if (Array.isArray(I)) return a(I);
      }
      function u(I) {
        if (typeof Symbol != "undefined" && I[Symbol.iterator] != null || I["@@iterator"] != null) return Array.from(I);
      }
      function l(I, A) {
        if (I) {
          if (typeof I == "string") return a(I, A);
          var V = Object.prototype.toString.call(I).slice(8, -1);
          if (V === "Object" && I.constructor && (V = I.constructor.name), V === "Map" || V === "Set") return Array.from(I);
          if (V === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(V)) return a(I, A);
        }
      }
      function a(I, A) {
        (A == null || A > I.length) && (A = I.length);
        for (var V = 0, K = new Array(A); V < A; V++) K[V] = I[V];
        return K;
      }
      function d() {
        throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
      }
      var p = Object.hasOwnProperty, h = Object.setPrototypeOf, m = Object.isFrozen, w = Object.getPrototypeOf, y = Object.getOwnPropertyDescriptor, v = Object.freeze, E = Object.seal, T = Object.create, k = typeof Reflect != "undefined" && Reflect, D = k.apply, N = k.construct;
      D || (D = function(A, V, K) {
        return A.apply(V, K);
      }), v || (v = function(A) {
        return A;
      }), E || (E = function(A) {
        return A;
      }), N || (N = function(A, V) {
        return i(A, s(V));
      });
      var M = te(Array.prototype.forEach), H = te(Array.prototype.pop), $ = te(Array.prototype.push), Y = te(String.prototype.toLowerCase), B = te(String.prototype.match), X = te(String.prototype.replace), Q = te(String.prototype.indexOf), S = te(String.prototype.trim), b = te(RegExp.prototype.test), W = he(TypeError);
      function te(I) {
        return function(A) {
          for (var V = arguments.length, K = new Array(V > 1 ? V - 1 : 0), ue = 1; ue < V; ue++)
            K[ue - 1] = arguments[ue];
          return D(I, A, K);
        };
      }
      function he(I) {
        return function() {
          for (var A = arguments.length, V = new Array(A), K = 0; K < A; K++)
            V[K] = arguments[K];
          return N(I, V);
        };
      }
      function j(I, A) {
        h && h(I, null);
        for (var V = A.length; V--; ) {
          var K = A[V];
          if (typeof K == "string") {
            var ue = Y(K);
            ue !== K && (m(A) || (A[V] = ue), K = ue);
          }
          I[K] = !0;
        }
        return I;
      }
      function le(I) {
        var A = T(null), V;
        for (V in I)
          D(p, I, [V]) && (A[V] = I[V]);
        return A;
      }
      function Re(I, A) {
        for (; I !== null; ) {
          var V = y(I, A);
          if (V) {
            if (V.get)
              return te(V.get);
            if (typeof V.value == "function")
              return te(V.value);
          }
          I = w(I);
        }
        function K(ue) {
          return console.warn("fallback value for", ue), null;
        }
        return K;
      }
      var wt = v(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "section", "select", "shadow", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]), ce = v(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]), Be = v(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]), xe = v(["animate", "color-profile", "cursor", "discard", "fedropshadow", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]), at = v(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover"]), fn = v(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]), Rt = v(["#text"]), xt = v(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "pattern", "placeholder", "playsinline", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "xmlns", "slot"]), ct = v(["accent-height", "accumulate", "additive", "alignment-baseline", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]), Ot = v(["accent", "accentunder", "align", "bevelled", "close", "columnsalign", "columnlines", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lspace", "lquote", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]), Ln = v(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]), Cl = E(/\{\{[\w\W]*|[\w\W]*\}\}/gm), kl = E(/<%[\w\W]*|[\w\W]*%>/gm), Nl = E(/^data-[\-\w.\u00B7-\uFFFF]/), Il = E(/^aria-[\-\w]+$/), Ml = E(
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        // eslint-disable-line no-useless-escape
      ), Al = E(/^(?:\w+script|data):/i), Rl = E(
        /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
        // eslint-disable-line no-control-regex
      ), xl = E(/^html$/i), Ol = function() {
        return typeof window == "undefined" ? null : window;
      }, Pl = function(A, V) {
        if (n(A) !== "object" || typeof A.createPolicy != "function")
          return null;
        var K = null, ue = "data-tt-policy-suffix";
        V.currentScript && V.currentScript.hasAttribute(ue) && (K = V.currentScript.getAttribute(ue));
        var Pt = "dompurify" + (K ? "#" + K : "");
        try {
          return A.createPolicy(Pt, {
            createHTML: function(ut) {
              return ut;
            }
          });
        } catch (lt) {
          return console.warn("TrustedTypes policy " + Pt + " could not be created."), null;
        }
      };
      function Wi() {
        var I = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : Ol(), A = function(g) {
          return Wi(g);
        };
        if (A.version = "2.3.8", A.removed = [], !I || !I.document || I.document.nodeType !== 9)
          return A.isSupported = !1, A;
        var V = I.document, K = I.document, ue = I.DocumentFragment, Pt = I.HTMLTemplateElement, lt = I.Node, ut = I.Element, pn = I.NodeFilter, hn = I.NamedNodeMap, Hl = hn === void 0 ? I.NamedNodeMap || I.MozNamedAttrMap : hn, $l = I.HTMLFormElement, Bl = I.DOMParser, Fl = I.trustedTypes, Hn = ut.prototype, Gl = Re(Hn, "cloneNode"), Ul = Re(Hn, "nextSibling"), zl = Re(Hn, "childNodes"), Ur = Re(Hn, "parentNode");
        if (typeof Pt == "function") {
          var zr = K.createElement("template");
          zr.content && zr.content.ownerDocument && (K = zr.content.ownerDocument);
        }
        var dt = Pl(Fl, V), Yi = dt ? dt.createHTML("") : "", $n = K, Wr = $n.implementation, Wl = $n.createNodeIterator, Yl = $n.createDocumentFragment, Vl = $n.getElementsByTagName, jl = V.importNode, Vi = {};
        try {
          Vi = le(K).documentMode ? K.documentMode : {};
        } catch (F) {
        }
        var Ye = {};
        A.isSupported = typeof Ur == "function" && Wr && typeof Wr.createHTMLDocument != "undefined" && Vi !== 9;
        var Yr = Cl, Vr = kl, ql = Nl, Xl = Il, Kl = Al, ji = Rl, jr = Ml, me = null, qi = j({}, [].concat(s(wt), s(ce), s(Be), s(at), s(Rt))), ye = null, Xi = j({}, [].concat(s(xt), s(ct), s(Ot), s(Ln))), de = Object.seal(Object.create(null, {
          tagNameCheck: {
            writable: !0,
            configurable: !1,
            enumerable: !0,
            value: null
          },
          attributeNameCheck: {
            writable: !0,
            configurable: !1,
            enumerable: !0,
            value: null
          },
          allowCustomizedBuiltInElements: {
            writable: !0,
            configurable: !1,
            enumerable: !0,
            value: !1
          }
        })), mn = null, qr = null, Ki = !0, Xr = !0, Zi = !1, Lt = !1, Et = !1, Kr = !1, Zr = !1, Ht = !1, Bn = !1, Fn = !1, Ji = !0, Jr = !0, gn = !1, $t = {}, Bt = null, Qi = j({}, ["annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "thead", "title", "video", "xmp"]), es = null, ts = j({}, ["audio", "video", "img", "source", "image", "track"]), Qr = null, ns = j({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]), eo = "http://www.w3.org/1998/Math/MathML", to = "http://www.w3.org/2000/svg", ft = "http://www.w3.org/1999/xhtml", Gn = ft, no = !1, Ft, Zl = ["application/xhtml+xml", "text/html"], Jl = "text/html", Dt, Gt = null, Ql = K.createElement("form"), rs = function(g) {
          return g instanceof RegExp || g instanceof Function;
        }, ro = function(g) {
          Gt && Gt === g || ((!g || n(g) !== "object") && (g = {}), g = le(g), me = "ALLOWED_TAGS" in g ? j({}, g.ALLOWED_TAGS) : qi, ye = "ALLOWED_ATTR" in g ? j({}, g.ALLOWED_ATTR) : Xi, Qr = "ADD_URI_SAFE_ATTR" in g ? j(le(ns), g.ADD_URI_SAFE_ATTR) : ns, es = "ADD_DATA_URI_TAGS" in g ? j(le(ts), g.ADD_DATA_URI_TAGS) : ts, Bt = "FORBID_CONTENTS" in g ? j({}, g.FORBID_CONTENTS) : Qi, mn = "FORBID_TAGS" in g ? j({}, g.FORBID_TAGS) : {}, qr = "FORBID_ATTR" in g ? j({}, g.FORBID_ATTR) : {}, $t = "USE_PROFILES" in g ? g.USE_PROFILES : !1, Ki = g.ALLOW_ARIA_ATTR !== !1, Xr = g.ALLOW_DATA_ATTR !== !1, Zi = g.ALLOW_UNKNOWN_PROTOCOLS || !1, Lt = g.SAFE_FOR_TEMPLATES || !1, Et = g.WHOLE_DOCUMENT || !1, Ht = g.RETURN_DOM || !1, Bn = g.RETURN_DOM_FRAGMENT || !1, Fn = g.RETURN_TRUSTED_TYPE || !1, Zr = g.FORCE_BODY || !1, Ji = g.SANITIZE_DOM !== !1, Jr = g.KEEP_CONTENT !== !1, gn = g.IN_PLACE || !1, jr = g.ALLOWED_URI_REGEXP || jr, Gn = g.NAMESPACE || ft, g.CUSTOM_ELEMENT_HANDLING && rs(g.CUSTOM_ELEMENT_HANDLING.tagNameCheck) && (de.tagNameCheck = g.CUSTOM_ELEMENT_HANDLING.tagNameCheck), g.CUSTOM_ELEMENT_HANDLING && rs(g.CUSTOM_ELEMENT_HANDLING.attributeNameCheck) && (de.attributeNameCheck = g.CUSTOM_ELEMENT_HANDLING.attributeNameCheck), g.CUSTOM_ELEMENT_HANDLING && typeof g.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements == "boolean" && (de.allowCustomizedBuiltInElements = g.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements), Ft = // eslint-disable-next-line unicorn/prefer-includes
          Zl.indexOf(g.PARSER_MEDIA_TYPE) === -1 ? Ft = Jl : Ft = g.PARSER_MEDIA_TYPE, Dt = Ft === "application/xhtml+xml" ? function(C) {
            return C;
          } : Y, Lt && (Xr = !1), Bn && (Ht = !0), $t && (me = j({}, s(Rt)), ye = [], $t.html === !0 && (j(me, wt), j(ye, xt)), $t.svg === !0 && (j(me, ce), j(ye, ct), j(ye, Ln)), $t.svgFilters === !0 && (j(me, Be), j(ye, ct), j(ye, Ln)), $t.mathMl === !0 && (j(me, at), j(ye, Ot), j(ye, Ln))), g.ADD_TAGS && (me === qi && (me = le(me)), j(me, g.ADD_TAGS)), g.ADD_ATTR && (ye === Xi && (ye = le(ye)), j(ye, g.ADD_ATTR)), g.ADD_URI_SAFE_ATTR && j(Qr, g.ADD_URI_SAFE_ATTR), g.FORBID_CONTENTS && (Bt === Qi && (Bt = le(Bt)), j(Bt, g.FORBID_CONTENTS)), Jr && (me["#text"] = !0), Et && j(me, ["html", "head", "body"]), me.table && (j(me, ["tbody"]), delete mn.tbody), v && v(g), Gt = g);
        }, os = j({}, ["mi", "mo", "mn", "ms", "mtext"]), is = j({}, ["foreignobject", "desc", "title", "annotation-xml"]), eu = j({}, ["title", "style", "font", "a", "script"]), Un = j({}, ce);
        j(Un, Be), j(Un, xe);
        var oo = j({}, at);
        j(oo, fn);
        var tu = function(g) {
          var C = Ur(g);
          (!C || !C.tagName) && (C = {
            namespaceURI: ft,
            tagName: "template"
          });
          var L = Y(g.tagName), oe = Y(C.tagName);
          return g.namespaceURI === to ? C.namespaceURI === ft ? L === "svg" : C.namespaceURI === eo ? L === "svg" && (oe === "annotation-xml" || os[oe]) : !!Un[L] : g.namespaceURI === eo ? C.namespaceURI === ft ? L === "math" : C.namespaceURI === to ? L === "math" && is[oe] : !!oo[L] : g.namespaceURI === ft ? C.namespaceURI === to && !is[oe] || C.namespaceURI === eo && !os[oe] ? !1 : !oo[L] && (eu[L] || !Un[L]) : !1;
        }, Je = function(g) {
          $(A.removed, {
            element: g
          });
          try {
            g.parentNode.removeChild(g);
          } catch (C) {
            try {
              g.outerHTML = Yi;
            } catch (L) {
              g.remove();
            }
          }
        }, ss = function(g, C) {
          try {
            $(A.removed, {
              attribute: C.getAttributeNode(g),
              from: C
            });
          } catch (L) {
            $(A.removed, {
              attribute: null,
              from: C
            });
          }
          if (C.removeAttribute(g), g === "is" && !ye[g])
            if (Ht || Bn)
              try {
                Je(C);
              } catch (L) {
              }
            else
              try {
                C.setAttribute(g, "");
              } catch (L) {
              }
        }, as = function(g) {
          var C, L;
          if (Zr)
            g = "<remove></remove>" + g;
          else {
            var oe = B(g, /^[\r\n\t ]+/);
            L = oe && oe[0];
          }
          Ft === "application/xhtml+xml" && (g = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + g + "</body></html>");
          var ke = dt ? dt.createHTML(g) : g;
          if (Gn === ft)
            try {
              C = new Bl().parseFromString(ke, Ft);
            } catch (we) {
            }
          if (!C || !C.documentElement) {
            C = Wr.createDocument(Gn, "template", null);
            try {
              C.documentElement.innerHTML = no ? "" : ke;
            } catch (we) {
            }
          }
          var De = C.body || C.documentElement;
          return g && L && De.insertBefore(K.createTextNode(L), De.childNodes[0] || null), Gn === ft ? Vl.call(C, Et ? "html" : "body")[0] : Et ? C.documentElement : De;
        }, cs = function(g) {
          return Wl.call(
            g.ownerDocument || g,
            g,
            // eslint-disable-next-line no-bitwise
            pn.SHOW_ELEMENT | pn.SHOW_COMMENT | pn.SHOW_TEXT,
            null,
            !1
          );
        }, nu = function(g) {
          return g instanceof $l && (typeof g.nodeName != "string" || typeof g.textContent != "string" || typeof g.removeChild != "function" || !(g.attributes instanceof Hl) || typeof g.removeAttribute != "function" || typeof g.setAttribute != "function" || typeof g.namespaceURI != "string" || typeof g.insertBefore != "function");
        }, vn = function(g) {
          return n(lt) === "object" ? g instanceof lt : g && n(g) === "object" && typeof g.nodeType == "number" && typeof g.nodeName == "string";
        }, Qe = function(g, C, L) {
          Ye[g] && M(Ye[g], function(oe) {
            oe.call(A, C, L, Gt);
          });
        }, ls = function(g) {
          var C;
          if (Qe("beforeSanitizeElements", g, null), nu(g) || b(/[\u0080-\uFFFF]/, g.nodeName))
            return Je(g), !0;
          var L = Dt(g.nodeName);
          if (Qe("uponSanitizeElement", g, {
            tagName: L,
            allowedTags: me
          }), g.hasChildNodes() && !vn(g.firstElementChild) && (!vn(g.content) || !vn(g.content.firstElementChild)) && b(/<[/\w]/g, g.innerHTML) && b(/<[/\w]/g, g.textContent) || L === "select" && b(/<template/i, g.innerHTML))
            return Je(g), !0;
          if (!me[L] || mn[L]) {
            if (!mn[L] && ds(L) && (de.tagNameCheck instanceof RegExp && b(de.tagNameCheck, L) || de.tagNameCheck instanceof Function && de.tagNameCheck(L)))
              return !1;
            if (Jr && !Bt[L]) {
              var oe = Ur(g) || g.parentNode, ke = zl(g) || g.childNodes;
              if (ke && oe)
                for (var De = ke.length, we = De - 1; we >= 0; --we)
                  oe.insertBefore(Gl(ke[we], !0), Ul(g));
            }
            return Je(g), !0;
          }
          return g instanceof ut && !tu(g) || (L === "noscript" || L === "noembed") && b(/<\/no(script|embed)/i, g.innerHTML) ? (Je(g), !0) : (Lt && g.nodeType === 3 && (C = g.textContent, C = X(C, Yr, " "), C = X(C, Vr, " "), g.textContent !== C && ($(A.removed, {
            element: g.cloneNode()
          }), g.textContent = C)), Qe("afterSanitizeElements", g, null), !1);
        }, us = function(g, C, L) {
          if (Ji && (C === "id" || C === "name") && (L in K || L in Ql))
            return !1;
          if (!(Xr && !qr[C] && b(ql, C))) {
            if (!(Ki && b(Xl, C))) {
              if (!ye[C] || qr[C]) {
                if (
                  // First condition does a very basic check if a) it's basically a valid custom element tagname AND
                  // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
                  // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
                  !(ds(g) && (de.tagNameCheck instanceof RegExp && b(de.tagNameCheck, g) || de.tagNameCheck instanceof Function && de.tagNameCheck(g)) && (de.attributeNameCheck instanceof RegExp && b(de.attributeNameCheck, C) || de.attributeNameCheck instanceof Function && de.attributeNameCheck(C)) || // Alternative, second condition checks if it's an `is`-attribute, AND
                  // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
                  C === "is" && de.allowCustomizedBuiltInElements && (de.tagNameCheck instanceof RegExp && b(de.tagNameCheck, L) || de.tagNameCheck instanceof Function && de.tagNameCheck(L)))
                ) return !1;
              } else if (!Qr[C]) {
                if (!b(jr, X(L, ji, ""))) {
                  if (!((C === "src" || C === "xlink:href" || C === "href") && g !== "script" && Q(L, "data:") === 0 && es[g])) {
                    if (!(Zi && !b(Kl, X(L, ji, "")))) {
                      if (L) return !1;
                    }
                  }
                }
              }
            }
          }
          return !0;
        }, ds = function(g) {
          return g.indexOf("-") > 0;
        }, fs = function(g) {
          var C, L, oe, ke;
          Qe("beforeSanitizeAttributes", g, null);
          var De = g.attributes;
          if (De) {
            var we = {
              attrName: "",
              attrValue: "",
              keepAttr: !0,
              allowedAttributes: ye
            };
            for (ke = De.length; ke--; ) {
              C = De[ke];
              var zn = C, Te = zn.name, ps = zn.namespaceURI;
              if (L = Te === "value" ? C.value : S(C.value), oe = Dt(Te), we.attrName = oe, we.attrValue = L, we.keepAttr = !0, we.forceKeepAttr = void 0, Qe("uponSanitizeAttribute", g, we), L = we.attrValue, !we.forceKeepAttr && (ss(Te, g), !!we.keepAttr)) {
                if (b(/\/>/i, L)) {
                  ss(Te, g);
                  continue;
                }
                Lt && (L = X(L, Yr, " "), L = X(L, Vr, " "));
                var ou = Dt(g.nodeName);
                if (us(ou, oe, L))
                  try {
                    ps ? g.setAttributeNS(ps, Te, L) : g.setAttribute(Te, L), H(A.removed);
                  } catch (Tg) {
                  }
              }
            }
            Qe("afterSanitizeAttributes", g, null);
          }
        }, ru = function F(g) {
          var C, L = cs(g);
          for (Qe("beforeSanitizeShadowDOM", g, null); C = L.nextNode(); )
            Qe("uponSanitizeShadowNode", C, null), !ls(C) && (C.content instanceof ue && F(C.content), fs(C));
          Qe("afterSanitizeShadowDOM", g, null);
        };
        return A.sanitize = function(F, g) {
          var C, L, oe, ke, De;
          if (no = !F, no && (F = "<!-->"), typeof F != "string" && !vn(F)) {
            if (typeof F.toString != "function")
              throw W("toString is not a function");
            if (F = F.toString(), typeof F != "string")
              throw W("dirty is not a string, aborting");
          }
          if (!A.isSupported) {
            if (n(I.toStaticHTML) === "object" || typeof I.toStaticHTML == "function") {
              if (typeof F == "string")
                return I.toStaticHTML(F);
              if (vn(F))
                return I.toStaticHTML(F.outerHTML);
            }
            return F;
          }
          if (Kr || ro(g), A.removed = [], typeof F == "string" && (gn = !1), gn) {
            if (F.nodeName) {
              var we = Dt(F.nodeName);
              if (!me[we] || mn[we])
                throw W("root node is forbidden and cannot be sanitized in-place");
            }
          } else if (F instanceof lt)
            C = as("<!---->"), L = C.ownerDocument.importNode(F, !0), L.nodeType === 1 && L.nodeName === "BODY" || L.nodeName === "HTML" ? C = L : C.appendChild(L);
          else {
            if (!Ht && !Lt && !Et && // eslint-disable-next-line unicorn/prefer-includes
            F.indexOf("<") === -1)
              return dt && Fn ? dt.createHTML(F) : F;
            if (C = as(F), !C)
              return Ht ? null : Fn ? Yi : "";
          }
          C && Zr && Je(C.firstChild);
          for (var zn = cs(gn ? F : C); oe = zn.nextNode(); )
            oe.nodeType === 3 && oe === ke || ls(oe) || (oe.content instanceof ue && ru(oe.content), fs(oe), ke = oe);
          if (ke = null, gn)
            return F;
          if (Ht) {
            if (Bn)
              for (De = Yl.call(C.ownerDocument); C.firstChild; )
                De.appendChild(C.firstChild);
            else
              De = C;
            return ye.shadowroot && (De = jl.call(V, De, !0)), De;
          }
          var Te = Et ? C.outerHTML : C.innerHTML;
          return Et && me["!doctype"] && C.ownerDocument && C.ownerDocument.doctype && C.ownerDocument.doctype.name && b(xl, C.ownerDocument.doctype.name) && (Te = "<!DOCTYPE " + C.ownerDocument.doctype.name + `>
` + Te), Lt && (Te = X(Te, Yr, " "), Te = X(Te, Vr, " ")), dt && Fn ? dt.createHTML(Te) : Te;
        }, A.setConfig = function(F) {
          ro(F), Kr = !0;
        }, A.clearConfig = function() {
          Gt = null, Kr = !1;
        }, A.isValidAttribute = function(F, g, C) {
          Gt || ro({});
          var L = Dt(F), oe = Dt(g);
          return us(L, oe, C);
        }, A.addHook = function(F, g) {
          typeof g == "function" && (Ye[F] = Ye[F] || [], $(Ye[F], g));
        }, A.removeHook = function(F) {
          if (Ye[F])
            return H(Ye[F]);
        }, A.removeHooks = function(F) {
          Ye[F] && (Ye[F] = []);
        }, A.removeAllHooks = function() {
          Ye = {};
        }, A;
      }
      var Ll = Wi();
      return Ll;
    }));
  })(cr)), cr.exports;
}
var Do, ra;
function df() {
  return ra || (ra = 1, Do = window.DOMPurify || (window.DOMPurify = na().default || na())), Do;
}
var ff = df();
const Dr = /* @__PURE__ */ st(ff), Kn = "data-target-temp";
function pf() {
  Dr.addHook("beforeSanitizeAttributes", (e) => {
    if (e.tagName === "A") {
      const t = e.getAttribute("target");
      t ? e.setAttribute(Kn, t) : e.setAttribute("target", "_self");
    }
  }), Dr.addHook("afterSanitizeAttributes", (e) => {
    e.tagName === "A" && e.hasAttribute(Kn) && (e.setAttribute("target", e.getAttribute(Kn)), e.removeAttribute(Kn), e.getAttribute("target") === "_blank" && e.setAttribute("rel", "noopener"));
  });
}
function hf() {
  Dr.removeAllHooks();
}
function mf(e) {
  return Dr.sanitize(e);
}
function ne({ template: e, param: t, as: n = "div" }) {
  var s;
  const o = G(Cc)[e];
  if (z(o))
    return null;
  const i = o(t);
  return be(i) ? pt(n, {
    className: _(`template-${e}`),
    dangerouslySetInnerHTML: {
      __html: mf(i)
    }
  }) : pu(i, {
    className: `${(s = i.props.className) != null ? s : ""} ${_(`template-${e}`)}`
  });
}
const kc = kr(
  null
), gf = kc.Provider, Ce = () => {
  const e = Nn(kc);
  if (!e)
    throw new Error("useEventBus must be used within a EventBusProvider");
  return e;
}, Lr = (e) => {
  var t, n, r, o, i;
  return (i = (o = (r = (n = (t = e.options) == null ? void 0 : t.timezone) == null ? void 0 : n.zones) == null ? void 0 : r[0]) == null ? void 0 : o.timezoneName) != null ? i : "Local";
}, vf = (e) => {
  var t, n;
  return (n = (t = e.options) == null ? void 0 : t.timezone) == null ? void 0 : n.customOffsetCalculator;
}, Nc = (e) => {
  var t;
  return (t = e.options.timezone.zones) != null ? t : [];
};
function Hr() {
  const e = G(vf), t = x(e);
  return J(
    (n, r = new O()) => r.tz(
      t ? e(n, r.getTime()) : n
    ),
    [e, t]
  );
}
function $r() {
  const e = G(Lr), t = Hr(), n = J(
    () => t(e),
    [e, t]
  );
  return [e, n];
}
function _f(e, t) {
  return e === "week";
}
function yf({
  dayName: e,
  theme: t,
  today: n
}) {
  var c, u;
  const { day: r, dateInstance: o } = e, i = kt(n, o), s = !i && o < n;
  return Ei(r) ? t.common.holiday.color : s ? (c = t.week) == null ? void 0 : c.pastDay.color : Di(r) ? t.common.saturday.color : i ? (u = t.week) == null ? void 0 : u.today.color : t.common.dayName.color;
}
function wf({
  dayName: e,
  theme: t
}) {
  const { day: n } = e;
  return Ei(n) ? t.common.holiday.color : Di(n) ? t.common.saturday.color : t.common.dayName.color;
}
function Ef({ dayName: e, style: t, type: n, theme: r }) {
  const o = Ce(), [, i] = $r(), s = i(), { day: c } = e, u = n === "week" ? yf({ dayName: e, theme: r, today: s }) : wf({ dayName: e, theme: r }), l = `${n}DayName`, a = () => {
    _f(n) && o.fire("clickDayName", { date: fe(e.dateInstance, "YYYY-MM-DD") });
  };
  return /* @__PURE__ */ f("div", { className: _("day-name-item", n), style: t, children: /* @__PURE__ */ f(
    "span",
    {
      className: _({ [`holiday-${Er(c)}`]: $e(c) }),
      style: { color: u },
      onClick: a,
      "data-testid": `dayName-${n}-${Er(c)}`,
      children: /* @__PURE__ */ f(ne, { template: l, param: e })
    }
  ) });
}
const Ic = _t("common"), Df = _t("month"), Mc = (e) => e.week.dayGridLeft, bi = (e) => e.week.timeGridLeft, Sf = (e) => e.month.moreView, Ac = (e) => e.month.gridCell, Tf = {
  border: "1px solid #e5e5e5",
  backgroundColor: "white",
  holiday: {
    color: "#ff4040"
  },
  saturday: {
    color: "#333"
  },
  dayName: {
    color: "#333"
  },
  today: {
    color: "#fff"
  },
  gridSelection: {
    backgroundColor: "rgba(81, 92, 230, 0.05)",
    border: "1px solid #515ce6"
  }
}, bf = {
  dayName: {
    borderLeft: "none",
    borderTop: "1px solid #e5e5e5",
    borderBottom: "1px solid #e5e5e5",
    backgroundColor: "inherit"
  },
  weekend: {
    backgroundColor: "inherit"
  },
  today: {
    color: "inherit",
    backgroundColor: "rgba(81, 92, 230, 0.05)"
  },
  pastDay: {
    color: "#bbb"
  },
  panelResizer: {
    border: "1px solid #e5e5e5"
  },
  dayGrid: {
    borderRight: "1px solid #e5e5e5",
    backgroundColor: "inherit"
  },
  dayGridLeft: {
    borderRight: "1px solid #e5e5e5",
    backgroundColor: "inherit",
    width: "72px"
  },
  timeGrid: {
    borderRight: "1px solid #e5e5e5"
  },
  timeGridLeft: {
    backgroundColor: "inherit",
    borderRight: "1px solid #e5e5e5",
    width: "72px"
  },
  timeGridLeftAdditionalTimezone: {
    backgroundColor: "white"
  },
  timeGridHalfHourLine: {
    borderBottom: "none"
  },
  timeGridHourLine: {
    borderBottom: "1px solid #e5e5e5"
  },
  nowIndicatorLabel: {
    color: "#515ce6"
  },
  nowIndicatorPast: {
    border: "1px dashed #515ce6"
  },
  nowIndicatorBullet: {
    backgroundColor: "#515ce6"
  },
  nowIndicatorToday: {
    border: "1px solid #515ce6"
  },
  nowIndicatorFuture: {
    border: "none"
  },
  pastTime: {
    color: "#bbb"
  },
  futureTime: {
    color: "#333"
  },
  gridSelection: {
    color: "#515ce6"
  }
}, Cf = {
  dayName: {
    borderLeft: "none",
    backgroundColor: "inherit"
  },
  holidayExceptThisMonth: {
    color: "rgba(255, 64, 64, 0.4)"
  },
  dayExceptThisMonth: {
    color: "rgba(51, 51, 51, 0.4)"
  },
  weekend: {
    backgroundColor: "inherit"
  },
  moreView: {
    border: "1px solid #d5d5d5",
    boxShadow: "0 2px 6px 0 rgba(0, 0, 0, 0.1)",
    backgroundColor: "white",
    width: null,
    height: null
  },
  gridCell: {
    headerHeight: 31,
    footerHeight: null
  },
  moreViewTitle: {
    backgroundColor: "inherit"
  }
};
function kf(e = {}) {
  return {
    common: Ue(Tf, e)
  };
}
function Nf(e) {
  return {
    setTheme: (t) => {
      e(
        Z((n) => {
          n.common = Ue(n.common, t.common), n.week = Ue(n.week, t.week), n.month = Ue(n.month, t.month);
        })
      );
    },
    setCommonTheme: (t) => {
      e(
        Z((n) => {
          n.common = Ue(n.common, t);
        })
      );
    },
    setWeekTheme: (t) => {
      e(
        Z((n) => {
          n.week = Ue(n.week, t);
        })
      );
    },
    setMonthTheme: (t) => {
      e(
        Z((n) => {
          n.month = Ue(n.month, t);
        })
      );
    }
  };
}
function If(e = {}) {
  return {
    month: Ue(Cf, e)
  };
}
function Mf(e = {}) {
  return {
    week: Ue(bf, e)
  };
}
const Af = (e = {}) => (t) => ae(R(R(R({}, kf(e == null ? void 0 : e.common)), Mf(e == null ? void 0 : e.week)), If(e == null ? void 0 : e.month)), {
  dispatch: R({}, Nf(t))
}), Rf = (e = {}) => Sc(Af(e)), {
  StoreProvider: xf,
  useStore: ie
} = Dc();
function Of() {
  return ie(Ic);
}
function Rc() {
  return ie(Df);
}
function Pf(e) {
  return {
    common: {
      saturday: e.common.saturday,
      holiday: e.common.holiday,
      today: e.common.today,
      dayName: e.common.dayName
    },
    week: {
      pastDay: e.week.pastDay,
      today: e.week.today,
      dayName: e.week.dayName
    }
  };
}
function Lf(e) {
  return {
    common: {
      saturday: e.common.saturday,
      holiday: e.common.holiday,
      today: e.common.today,
      dayName: e.common.dayName
    },
    month: {
      dayName: e.month.dayName
    }
  };
}
function Ci({
  dayNames: e,
  marginLeft: t = Mu,
  rowStyleInfo: n,
  type: r = "month"
}) {
  var a, d;
  const o = ie(r === "month" ? Lf : Pf), p = (d = (a = o[r]) == null ? void 0 : a.dayName) != null ? d : {}, { backgroundColor: i = "white", borderLeft: s = null } = p, c = Yn(p, ["backgroundColor", "borderLeft"]), { borderTop: u = null, borderBottom: l = null } = c;
  return /* @__PURE__ */ f(
    "div",
    {
      "data-testid": `grid-header-${r}`,
      className: _("day-names", r),
      style: {
        backgroundColor: i,
        borderTop: u,
        borderBottom: l
      },
      children: /* @__PURE__ */ f("div", { className: _("day-name-container"), style: { marginLeft: t }, children: e.map((h, m) => /* @__PURE__ */ f(
        Ef,
        {
          type: r,
          dayName: h,
          style: {
            width: q(n[m].width),
            left: q(n[m].left),
            borderLeft: s
          },
          theme: o
        },
        `dayNames-${h.day}`
      )) })
    }
  );
}
const Hf = 6;
var An = /* @__PURE__ */ ((e) => (e.header = "header", e.footer = "footer", e))(An || {});
function Br(e, t = !0) {
  const n = [];
  let r;
  return e.length && (n[0] = [e[0].cid()], e.slice(1).forEach((o, i) => {
    r = e.slice(0, i + 1).reverse();
    const s = r.find(
      (c) => o.collidesWith(c, t)
    );
    s ? n.slice().reverse().some((c) => ~c.indexOf(s.cid()) ? (c.push(o.cid()), !0) : !1) : n.push([o.cid()]);
  })), n;
}
function $f(e, t) {
  let { length: n } = e;
  for (; n > 0; )
    if (n -= 1, !Ze(e[n][t]))
      return n;
  return -1;
}
function Fr(e, t, n = !0) {
  const r = [];
  return t.forEach((o) => {
    const i = [[]];
    o.forEach((s) => {
      const c = e.get(s);
      let u = 0, l = !1, a, d;
      for (; !l; )
        d = $f(i, u), d === -1 ? (i[0].push(c), l = !0) : c.collidesWith(i[d][u], n) || (a = d + 1, Ze(i[a]) && (i[a] = []), i[a][u] = c, l = !0), u += 1;
    }), r.push(i);
  }), r;
}
function xc(e, t) {
  return (n) => {
    const r = n.getStarts();
    return !(n.getEnds() < e || r > t);
  };
}
function Oc(e, t, n, r) {
  const o = qo(e, t, ot).map(
    (i) => fe(i, "YYYYMMDD")
  );
  n.forEach((i) => {
    i.forEach((s) => {
      s.forEach((c, u) => {
        if (!c)
          return;
        const l = fe(c.getStarts(), "YYYYMMDD"), a = qo(
          pe(c.getStarts()),
          Ae(c.getEnds()),
          ot
        ).length;
        c.top = u, c.left = o.indexOf(l), c.width = a, r == null || r(c);
      });
    });
  });
}
function oa(e, t, n) {
  return n.getStarts() < e && (n.exceedLeft = !0, n.renderStarts = new O(e)), n.getEnds() > t && (n.exceedRight = !0, n.renderEnds = new O(t)), n;
}
function Pc(e, t, n) {
  return n instanceof Xe ? (n.each((r) => (oa(e, t, r), !0)), null) : oa(e, t, n);
}
function Lc(e) {
  const t = new Xe((n) => n.cid());
  return e.each(function(n) {
    t.add(new bt(n));
  }), t;
}
function ki({ model: e }) {
  return e.isAllday || e.hasMultiDates;
}
function Hc(e) {
  return !ki(e);
}
function Bf(e) {
  e.top = e.top || 0, e.top += 1;
}
function Ff(e, t, n) {
  n.each((r) => {
    (r.model.isAllday || r.model.hasMultiDates) && Pc(pe(e), Ae(t), r);
  });
}
function Gf(e, t, n) {
  const r = [];
  return e[t].forEach((o) => {
    n.doWhenHas(o, (i) => {
      r.push(i.top);
    });
  }), r.length > 0 ? Math.max(...r) : 0;
}
function Uf(e, t) {
  const n = t.filter(ki), r = t.filter(Hc).sort(Ct.compare.event.asc), o = {};
  r.forEach((i) => {
    const s = fe(i.getStarts(), "YYYYMMDD");
    let c = o[s];
    Ze(c) && (c = o[s] = Gf(
      e,
      s,
      n
    )), o[s] = i.top = c + 1;
  });
}
function zf(e, t) {
  const n = t.filter(ki), r = t.filter(Hc).sort(Ct.compare.event.asc), o = {};
  r.forEach((i) => {
    const s = fe(i.getStarts(), "YYYYMMDD");
    let c = o[s];
    if (Ze(c) && (c = o[s] = [], e[s].forEach((u) => {
      n.doWhenHas(u, (l) => {
        c.push(l.top);
      });
    })), c.indexOf(i.top) >= 0) {
      const u = Math.max(...c) + 1;
      for (let l = 1; l <= u && (i.top = l, !(c.indexOf(i.top) < 0)); l += 1)
        ;
    }
    c.push(i.top);
  });
}
function Wf(e) {
  e.each((t) => {
    const { model: n } = t, r = n.getStarts(), o = n.getEnds();
    n.hasMultiDates = !kt(r, o), !n.isAllday && n.hasMultiDates && (t.renderStarts = pe(r), t.renderEnds = Ae(o));
  });
}
function Yf(e, t) {
  const { start: n, end: r, andFilters: o = [], alldayFirstMode: i = !1 } = t, { events: s, idsOfDay: c } = e, u = Xe.and(...[xc(n, r)].concat(o)), l = s.filter(u), a = Lc(l);
  Wf(a), Ff(n, r, a);
  const d = a.sort(Ct.compare.event.asc), p = !1, h = Br(d, p), m = Fr(a, h, p);
  return Oc(n, r, m, Bf), i ? Uf(c, a) : zf(c, a), m;
}
function Vf(e, t) {
  return (n) => {
    const r = n.getStarts(), o = n.getEnds(), i = r.getTime(), s = o.getTime(), c = r.getFullYear(), u = r.getMonth(), l = r.getDate(), a = new O(c, u, l).setHours(e), d = new O(c, u, l).setHours(t);
    return i >= a && i < d || s > a && s <= d || i < a && s > a || s > d && i < d;
  };
}
function jf(e, t) {
  return e === 0 && t === 24 ? (n) => n.sort(Ct.compare.event.asc) : (n) => n.filter(Vf(e, t)).sort(Ct.compare.event.asc);
}
function qf(e, t, n, r) {
  const o = {};
  return pc(t, n).forEach((s) => {
    const c = fe(s, "YYYYMMDD"), u = e[c], l = o[c] = new Xe((a) => a.cid());
    u && u.length && u.forEach((a) => {
      r.doWhenHas(a, (d) => {
        l.add(d);
      });
    });
  }, {}), o;
}
function Xf(e, t) {
  const { start: n, end: r, uiModelTimeColl: o, hourStart: i, hourEnd: s } = t, c = qf(e, n, r, o), u = {}, l = jf(i, s), a = !0;
  return Object.entries(c).forEach(([d, p]) => {
    const h = l(p), m = Br(h, a), w = Fr(p, m, a);
    u[d] = w;
  }), u;
}
function Kf(e) {
  e.each((t) => {
    const { model: n } = t;
    n.hasMultiDates = !0, t.renderStarts = pe(n.getStarts()), t.renderEnds = Ae(n.getEnds());
  });
}
function Zf(e, t, n) {
  if (!n || !n.size)
    return [];
  Kf(n), Pc(e, t, n);
  const r = n.sort(Ct.compare.event.asc), o = !0, i = Br(r, o), s = Fr(n, i, o);
  return Oc(e, t, s), s;
}
function Jf(e, t) {
  var m, w;
  const { start: n, end: r, panels: o, andFilters: i = [], options: s } = t, { events: c, idsOfDay: u } = e, l = (m = s == null ? void 0 : s.hourStart) != null ? m : 0, a = (w = s == null ? void 0 : s.hourEnd) != null ? w : 24, d = Xe.and(...[xc(n, r)].concat(i)), h = Lc(c.filter(d)).groupBy(Ad);
  return o.reduce(
    (y, v) => {
      const { name: E, type: T } = v;
      return z(h[E]) ? y : ae(R({}, y), {
        [E]: T === "daygrid" ? Zf(n, r, h[E]) : Xf(u, {
          start: n,
          end: r,
          uiModelTimeColl: h[E],
          hourStart: l,
          hourEnd: a
        })
      });
    },
    {
      milestone: [],
      task: [],
      allday: [],
      time: {}
    }
  );
}
function Zo(e, t, n) {
  const r = Math.max(e, ...t);
  return Math.min(r, ...n);
}
function $c(e, t, n) {
  return t * n / e;
}
function Bc(e, t, n) {
  return t <= e && e <= n;
}
const Ke = 17, Ni = 100;
function Fc(e, t) {
  e.forEach((n) => {
    n.forEach((r) => {
      r.forEach((o, i) => {
        t(o, i);
      });
    });
  });
}
function Ii(e, t) {
  return ({ top: n }) => e >= n * t;
}
function Qf(e, t) {
  return ({ top: n }) => e < n * t;
}
function Gc(e, t, n) {
  return e.filter(Qf(t, n)).length;
}
const ep = (e) => e.filter((t) => $e(t.getDay())).length;
function Mi(e, t, n) {
  const r = ep(e), o = e.length, i = r === o, s = n / (t && !i ? o * 2 - r : o), c = e.map((l) => {
    const a = l.getDay();
    return !t || i || $e(a) ? s : s * 2;
  }), u = c.reduce(
    (l, a, d) => d ? [...l, l[d - 1] + c[d - 1]] : [0],
    []
  );
  return {
    widthList: c,
    leftList: u
  };
}
function Sr(e, t, n) {
  return e.reduce((r, o, i) => t <= i && i <= n ? r + o : r, 0);
}
const tp = (e) => (t) => {
  const n = pe(t.getStarts()), r = pe(t.getEnds());
  return n <= e && e <= r;
};
function Tr(e, t) {
  return t.findIndex((n) => e >= pe(n) && e <= Ae(n));
}
const np = (e, t, n, r) => {
  const { widthList: o } = Mi(n, r, Ni);
  return {
    left: e ? Sr(o, 0, e - 1) : 0,
    width: Sr(o, e != null ? e : 0, t < 0 ? n.length - 1 : t)
  };
}, Uc = (e, t, n, r) => {
  const { widthList: o } = Mi(n, r, Ni);
  let i = 0, s = n.length - 1;
  return n.forEach((c, u) => {
    c <= e && (i = u), c <= t && (s = u);
  }), {
    width: Sr(o, i, s),
    left: i ? Sr(o, 0, i - 1) : 0
  };
};
function rp(e, t, n = !1) {
  const r = e.getStarts(), o = e.getEnds(), { width: i, left: s } = Uc(r, o, t, n);
  return e.width = i, e.left = s, e;
}
function op(e, t, n) {
  const { idsOfDay: r } = t, o = Yf(t, {
    start: e[0],
    end: Ae(e[e.length - 1])
  }), i = [];
  Fc(o, (c) => {
    const u = c.model.cid();
    i[u] = rp(c, e, n);
  });
  const s = Object.keys(r).reduce(
    (c, u) => {
      const l = r[u];
      return c[u] = l.map((a) => i[a]).filter((a) => !!a), c;
    },
    {}
  );
  return {
    uiModels: Object.values(i),
    gridDateEventModelMap: s
  };
}
const ip = (e, t, n = !1) => (Fc(e, (r) => {
  const o = r.getStarts(), i = r.getEnds(), { width: s, left: c } = Uc(o, i, t, n);
  r.width = s, r.left = c, r.top += 1;
}), zc(e)), sp = (e) => e.filter((t) => !!t);
function zc(e) {
  return e.flatMap((t) => t.flatMap((n) => sp(n)));
}
const ap = (e) => (
  // NOTE: there are same ui models in different rows. so we need to get unique ui models.
  Array.from(
    new Set(
      Object.values(e).reduce(
        (t, n) => t.concat(...zc(n)),
        []
      )
    )
  )
), Wc = (e, t, {
  narrowWeekend: n,
  hourStart: r,
  hourEnd: o,
  weekStartDate: i,
  weekEndDate: s
}) => {
  const u = Jf(t, {
    start: i,
    end: s,
    panels: [
      {
        name: "milestone",
        type: "daygrid",
        show: !0
      },
      {
        name: "task",
        type: "daygrid",
        show: !0
      },
      {
        name: "allday",
        type: "daygrid",
        show: !0
      },
      {
        name: "time",
        type: "timegrid",
        show: !0
      }
    ],
    andFilters: [],
    options: {
      hourStart: r,
      hourEnd: o
    }
  });
  return Object.keys(u).reduce(
    (l, a) => {
      const d = u[a];
      return ae(R({}, l), {
        [a]: Array.isArray(d) ? ip(d, e, n) : ap(d)
      });
    },
    {
      milestone: [],
      allday: [],
      task: [],
      time: []
    }
  );
};
function Yc(e, {
  workweek: t = !1,
  visibleWeeksCount: n = 0,
  startDayOfWeek: r = 0,
  isAlways6Weeks: o = !0
}) {
  const i = new O(e), s = n > 0, c = s ? i : dc(i), u = Sd(
    c,
    c.getDay() - r + (c.getDay() < r ? Ve : 0)
  ), l = u.getDay(), a = Dd(i).getDate(), d = Ti(u, c), p = a + Math.abs(d);
  let h = Hf;
  return s ? h = n : o === !1 && (h = Math.ceil(p / Ve)), mt(0, h).map(
    (m) => mt(0, Ve).reduce((w, y) => {
      const v = m * Ve + y, E = (v + l) % Ve;
      if (!t || t && !$e(E)) {
        const T = Nt(u, v);
        w.push(T);
      }
      return w;
    }, [])
  );
}
function Vc(e, { startDayOfWeek: t = rn.SUN, workweek: n }) {
  const r = pe(e), i = r.getDay() - t;
  return (i >= 0 ? mt(-i, Ve - i) : mt(-Ve - i, -i)).reduce((c, u) => {
    const l = Nt(r, u);
    return n && $e(l.getDay()) || c.push(l), c;
  }, []);
}
function cp(e, t = !1) {
  const n = e.length, r = n > 5 && t, o = r ? 100 / (n - 1) : 100 / n;
  return e.map((i) => {
    const s = r && $e(i.getDay()) ? o / 2 : o;
    return {
      date: i,
      width: s
    };
  }).reduce((i, s, c) => {
    const u = i[c - 1];
    return i.push(ae(R({}, s), {
      left: c === 0 ? 0 : u.left + u.width
    })), i;
  }, []);
}
function jc(e, t) {
  var s;
  const n = cp(e, (s = t.narrowWeekend) != null ? s : !1), r = (t.hourEnd - t.hourStart) * 2, o = 100 / r, i = mt(r).map((c, u) => {
    const l = u % 2 === 1, a = t.hourStart + Math.floor(c / 2), d = `${a}:${l ? "30" : "00"}`.padStart(5, "0"), p = (l ? `${a + 1}:00` : `${a}:30`).padStart(
      5,
      "0"
    );
    return {
      top: o * u,
      height: o,
      startTime: d,
      endTime: p
    };
  });
  return {
    columns: n,
    rows: i
  };
}
function lp({ clientX: e, clientY: t }, { left: n, top: r, clientLeft: o, clientTop: i }) {
  return [e - n - o, t - r - i];
}
function up(e, t, n) {
  const r = Math.floor($c(t, e, n));
  return Zo(r, [0], [e - 1]);
}
function Ai({
  rowsCount: e,
  columnsCount: t,
  container: n,
  narrowWeekend: r = !1,
  startDayOfWeek: o = rn.SUN
}) {
  if (z(n))
    return (() => null);
  const i = mt(o, o + t).map(
    (c) => c % Ve
  ), s = r ? i.filter((c) => $e(c)).length : 0;
  return function(u) {
    const {
      left: l,
      top: a,
      width: d,
      height: p
    } = n.getBoundingClientRect(), [h, m] = lp(u, {
      left: l,
      top: a,
      clientLeft: n.clientLeft,
      clientTop: n.clientTop
    });
    if (h < 0 || m < 0 || h > d || m > p)
      return null;
    const w = r ? d / (t - s + 1) : d / t, y = i.map(
      (T) => r && $e(T) ? w / 2 : w
    ), v = [];
    return y.forEach((T, k) => {
      k === 0 ? v.push(0) : v.push(v[k - 1] + y[k - 1]);
    }), {
      columnIndex: _i(v, (T) => h >= T),
      rowIndex: up(e, p, m)
    };
  };
}
function dp(e) {
  return e.common.gridSelection;
}
function Ri({ type: e, gridSelectionData: t, weekDates: n, narrowWeekend: r }) {
  const { backgroundColor: o, border: i } = ie(dp), { startCellIndex: s, endCellIndex: c } = t, { left: u, width: l } = np(
    Math.min(s, c),
    Math.max(s, c),
    n,
    r
  ), a = {
    left: q(u),
    width: q(l),
    height: q(100),
    backgroundColor: o,
    border: i
  };
  return l > 0 ? /* @__PURE__ */ f("div", { className: _(e, "grid-selection"), style: a }) : null;
}
function xi(e, t, n) {
  return {
    startColumnIndex: n ? t.columnIndex : e.columnIndex,
    startRowIndex: n ? t.rowIndex : e.rowIndex,
    endColumnIndex: n ? e.columnIndex : t.columnIndex,
    endRowIndex: n ? e.rowIndex : t.rowIndex
  };
}
function fp(e, t, n) {
  if (z(e))
    return null;
  const { startColumnIndex: r, endColumnIndex: o, endRowIndex: i, startRowIndex: s } = e;
  if (!Bc(t, r, o))
    return null;
  const l = {
    startRowIndex: s,
    endRowIndex: i,
    isSelectingMultipleColumns: r !== o,
    isStartingColumn: t === r
  };
  return r < t && t < o ? (l.startRowIndex = 0, l.endRowIndex = n) : r !== o && (r === t ? l.endRowIndex = n : o === t && (l.startRowIndex = 0)), l;
}
const Jo = {
  sortSelection: (e, t) => {
    const n = e.columnIndex > t.columnIndex || e.columnIndex === t.columnIndex && e.rowIndex > t.rowIndex;
    return xi(e, t, n);
  },
  getDateFromCollection: (e, t) => {
    const n = e, r = je(
      n.columns[t.startColumnIndex].date,
      n.rows[t.startRowIndex].startTime
    ), o = je(
      n.columns[t.endColumnIndex].date,
      n.rows[t.endRowIndex].endTime
    );
    return [r, o];
  },
  calculateSelection: fp
};
function pp(e, t, n) {
  if (!(x(e) && x(t) && x(n)))
    return null;
  const { startRowIndex: r, startColumnIndex: o, endRowIndex: i, endColumnIndex: s } = e;
  if (!Bc(
    t,
    Math.min(r, i),
    Math.max(r, i)
  ))
    return null;
  let c = o, u = s;
  return r < t && (c = 0), i > t && (u = n - 1), { startCellIndex: c, endCellIndex: u };
}
const br = {
  sortSelection: (e, t) => {
    const n = e.rowIndex > t.rowIndex || e.rowIndex === t.rowIndex && e.columnIndex > t.columnIndex;
    return xi(e, t, n);
  },
  getDateFromCollection: (e, t) => {
    const n = e;
    return [
      n[t.startRowIndex][t.startColumnIndex],
      n[t.endRowIndex][t.endColumnIndex]
    ];
  },
  calculateSelection: pp
};
function hp(e) {
  return x(e) ? {
    startCellIndex: e.startColumnIndex,
    endCellIndex: e.endColumnIndex
  } : null;
}
const Qo = {
  sortSelection: (e, t) => {
    const n = e.columnIndex > t.columnIndex;
    return xi(e, t, n);
  },
  getDateFromCollection: (e, t) => {
    const n = e;
    return [n[t.startColumnIndex], n[t.endColumnIndex]];
  },
  calculateSelection: hp
};
function mp(e) {
  return Qo.calculateSelection(e.gridSelection.dayGridWeek);
}
function gp({ weekDates: e, narrowWeekend: t }) {
  const n = G(mp);
  return z(n) ? null : /* @__PURE__ */ f(
    Ri,
    {
      type: "allday",
      gridSelectionData: n,
      weekDates: e,
      narrowWeekend: t
    }
  );
}
function qc(e, t) {
  for (var n in t) e[n] = t[n];
  return e;
}
function ei(e, t) {
  for (var n in e) if (n !== "__source" && !(n in t)) return !0;
  for (var r in t) if (r !== "__source" && e[r] !== t[r]) return !0;
  return !1;
}
function ia(e) {
  this.props = e;
}
function cn(e, t) {
  function n(o) {
    var i = this.props.ref, s = i == o.ref;
    return !s && i && (i.call ? i(null) : i.current = null), t ? !t(this.props, o) || !s : ei(this.props, o);
  }
  function r(o) {
    return this.shouldComponentUpdate = n, pt(e, o);
  }
  return r.displayName = "Memo(" + (e.displayName || e.name) + ")", r.prototype.isReactComponent = !0, r.__f = !0, r;
}
(ia.prototype = new nt()).isPureReactComponent = !0, ia.prototype.shouldComponentUpdate = function(e, t) {
  return ei(this.props, e) || ei(this.state, t);
};
var sa = P.__b;
P.__b = function(e) {
  e.type && e.type.__f && e.ref && (e.props.ref = e.ref, e.ref = null), sa && sa(e);
};
var vp = typeof Symbol != "undefined" && Symbol.for && Symbol.for("react.forward_ref") || 3911;
function Xc(e) {
  function t(n) {
    var r = qc({}, n);
    return delete r.ref, e(r, n.ref || null);
  }
  return t.$$typeof = vp, t.render = t, t.prototype.isReactComponent = t.__f = !0, t.displayName = "ForwardRef(" + (e.displayName || e.name) + ")", t;
}
var _p = P.__e;
P.__e = function(e, t, n, r) {
  if (e.then) {
    for (var o, i = t; i = i.__; ) if ((o = i.__c) && o.__c) return t.__e == null && (t.__e = n.__e, t.__k = n.__k), o.__c(e, t);
  }
  _p(e, t, n, r);
};
var aa = P.unmount;
function So() {
  this.__u = 0, this.t = null, this.__b = null;
}
function Kc(e) {
  var t = e.__.__c;
  return t && t.__a && t.__a(e);
}
function Zn() {
  this.u = null, this.o = null;
}
P.unmount = function(e) {
  var t = e.__c;
  t && t.__R && t.__R(), t && e.__h === !0 && (e.type = null), aa && aa(e);
}, (So.prototype = new nt()).__c = function(e, t) {
  var n = t.__c, r = this;
  r.t == null && (r.t = []), r.t.push(n);
  var o = Kc(r.__v), i = !1, s = function() {
    i || (i = !0, n.__R = null, o ? o(c) : c());
  };
  n.__R = s;
  var c = function() {
    if (!--r.__u) {
      if (r.state.__a) {
        var l = r.state.__a;
        r.__v.__k[0] = (function d(p, h, m) {
          return p && (p.__v = null, p.__k = p.__k && p.__k.map(function(w) {
            return d(w, h, m);
          }), p.__c && p.__c.__P === h && (p.__e && m.insertBefore(p.__e, p.__d), p.__c.__e = !0, p.__c.__P = m)), p;
        })(l, l.__c.__P, l.__c.__O);
      }
      var a;
      for (r.setState({ __a: r.__b = null }); a = r.t.pop(); ) a.forceUpdate();
    }
  }, u = t.__h === !0;
  r.__u++ || u || r.setState({ __a: r.__b = r.__v.__k[0] }), e.then(s, s);
}, So.prototype.componentWillUnmount = function() {
  this.t = [];
}, So.prototype.render = function(e, t) {
  if (this.__b) {
    if (this.__v.__k) {
      var n = document.createElement("div"), r = this.__v.__k[0].__c;
      this.__v.__k[0] = (function i(s, c, u) {
        return s && (s.__c && s.__c.__H && (s.__c.__H.__.forEach(function(l) {
          typeof l.__c == "function" && l.__c();
        }), s.__c.__H = null), (s = qc({}, s)).__c != null && (s.__c.__P === u && (s.__c.__P = c), s.__c = null), s.__k = s.__k && s.__k.map(function(l) {
          return i(l, c, u);
        })), s;
      })(this.__b, n, r.__O = r.__P);
    }
    this.__b = null;
  }
  var o = t.__a && pt(Me, null, e.fallback);
  return o && (o.__h = null), [pt(Me, null, t.__a ? null : e.children), o];
};
var ca = function(e, t, n) {
  if (++n[1] === n[0] && e.o.delete(t), e.props.revealOrder && (e.props.revealOrder[0] !== "t" || !e.o.size)) for (n = e.u; n; ) {
    for (; n.length > 3; ) n.pop()();
    if (n[1] < n[0]) break;
    e.u = n = n[2];
  }
};
function yp(e) {
  return this.getChildContext = function() {
    return e.context;
  }, e.children;
}
function wp(e) {
  var t = this, n = e.i;
  t.componentWillUnmount = function() {
    pr(null, t.l), t.l = null, t.i = null;
  }, t.i && t.i !== n && t.componentWillUnmount(), e.__v ? (t.l || (t.i = n, t.l = { nodeType: 1, parentNode: n, childNodes: [], appendChild: function(r) {
    this.childNodes.push(r), t.i.appendChild(r);
  }, insertBefore: function(r, o) {
    this.childNodes.push(r), t.i.appendChild(r);
  }, removeChild: function(r) {
    this.childNodes.splice(this.childNodes.indexOf(r) >>> 1, 1), t.i.removeChild(r);
  } }), pr(pt(yp, { context: t.context }, e.__v), t.l)) : t.l && t.componentWillUnmount();
}
function Oi(e, t) {
  var n = pt(wp, { __v: e, i: t });
  return n.containerInfo = t, n;
}
(Zn.prototype = new nt()).__a = function(e) {
  var t = this, n = Kc(t.__v), r = t.o.get(e);
  return r[0]++, function(o) {
    var i = function() {
      t.props.revealOrder ? (r.push(o), ca(t, e, r)) : o();
    };
    n ? n(i) : i();
  };
}, Zn.prototype.render = function(e) {
  this.u = null, this.o = /* @__PURE__ */ new Map();
  var t = Cn(e.children);
  e.revealOrder && e.revealOrder[0] === "b" && t.reverse();
  for (var n = t.length; n--; ) this.o.set(t[n], this.u = [1, 0, this.u]);
  return e.children;
}, Zn.prototype.componentDidUpdate = Zn.prototype.componentDidMount = function() {
  var e = this;
  this.o.forEach(function(t, n) {
    ca(e, n, t);
  });
};
var Ep = typeof Symbol != "undefined" && Symbol.for && Symbol.for("react.element") || 60103, Dp = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|marker(?!H|W|U)|overline|paint|shape|stop|strikethrough|stroke|text(?!L)|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, Sp = typeof document != "undefined", Tp = function(e) {
  return (typeof Symbol != "undefined" && typeof Symbol() == "symbol" ? /fil|che|rad/i : /fil|che|ra/i).test(e);
};
nt.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(e) {
  Object.defineProperty(nt.prototype, e, { configurable: !0, get: function() {
    return this["UNSAFE_" + e];
  }, set: function(t) {
    Object.defineProperty(this, e, { configurable: !0, writable: !0, value: t });
  } });
});
var la = P.event;
function bp() {
}
function Cp() {
  return this.cancelBubble;
}
function kp() {
  return this.defaultPrevented;
}
P.event = function(e) {
  return la && (e = la(e)), e.persist = bp, e.isPropagationStopped = Cp, e.isDefaultPrevented = kp, e.nativeEvent = e;
};
var ua = { configurable: !0, get: function() {
  return this.class;
} }, da = P.vnode;
P.vnode = function(e) {
  var t = e.type, n = e.props, r = n;
  if (typeof t == "string") {
    var o = t.indexOf("-") === -1;
    for (var i in r = {}, n) {
      var s = n[i];
      Sp && i === "children" && t === "noscript" || i === "value" && "defaultValue" in n && s == null || (i === "defaultValue" && "value" in n && n.value == null ? i = "value" : i === "download" && s === !0 ? s = "" : /ondoubleclick/i.test(i) ? i = "ondblclick" : /^onchange(textarea|input)/i.test(i + t) && !Tp(n.type) ? i = "oninput" : /^onfocus$/i.test(i) ? i = "onfocusin" : /^onblur$/i.test(i) ? i = "onfocusout" : /^on(Ani|Tra|Tou|BeforeInp|Compo)/.test(i) ? i = i.toLowerCase() : o && Dp.test(i) ? i = i.replace(/[A-Z0-9]/, "-$&").toLowerCase() : s === null && (s = void 0), /^oninput$/i.test(i) && (i = i.toLowerCase(), r[i] && (i = "oninputCapture")), r[i] = s);
    }
    t == "select" && r.multiple && Array.isArray(r.value) && (r.value = Cn(n.children).forEach(function(c) {
      c.props.selected = r.value.indexOf(c.props.value) != -1;
    })), t == "select" && r.defaultValue != null && (r.value = Cn(n.children).forEach(function(c) {
      c.props.selected = r.multiple ? r.defaultValue.indexOf(c.props.value) != -1 : r.defaultValue == c.props.value;
    })), e.props = r, n.class != n.className && (ua.enumerable = "className" in n, n.className != null && (r.class = n.className), Object.defineProperty(r, "className", ua));
  }
  e.$$typeof = Ep, da && da(e);
};
var fa = P.__r;
P.__r = function(e) {
  fa && fa(e), e.__c;
};
function Np(e) {
  return !!e.__k && (pr(null, e), !0);
}
function Ip({ index: e, exceedCount: t, isClicked: n, onClickExceedCount: r }) {
  const o = () => r(e), i = { display: n ? "none" : "" };
  return t && !n ? /* @__PURE__ */ f("span", { className: _("weekday-exceed-in-week"), onClick: o, style: i, children: /* @__PURE__ */ f(ne, { template: "weekGridFooterExceed", param: t }) }) : null;
}
function Mp({ isClicked: e, isClickedIndex: t, onClickCollapseButton: n }) {
  return e && t ? /* @__PURE__ */ f("span", { className: _("weekday-exceed-in-week"), onClick: n, children: /* @__PURE__ */ f(ne, { template: "collapseBtnTitle" }) }) : null;
}
function Ap({
  width: e,
  left: t,
  index: n,
  exceedCount: r,
  isClicked: o,
  onClickExceedCount: i,
  isClickedIndex: s,
  onClickCollapseButton: c,
  isLastCell: u
}) {
  const { borderRight: l, backgroundColor: a } = ie(J((p) => p.week.dayGrid, [])), d = {
    width: e,
    left: t,
    borderRight: u ? "none" : l,
    backgroundColor: a
  };
  return /* @__PURE__ */ f("div", { className: _("panel-grid"), style: d, children: [
    /* @__PURE__ */ f(
      Ip,
      {
        index: n,
        exceedCount: r,
        isClicked: o,
        onClickExceedCount: i
      }
    ),
    /* @__PURE__ */ f(
      Mp,
      {
        isClickedIndex: s,
        isClicked: o,
        onClickCollapseButton: c
      }
    )
  ] });
}
const Zc = cn(function({
  uiModels: t,
  weekDates: n,
  narrowWeekend: r,
  height: o,
  clickedIndex: i,
  isClickedCount: s,
  onClickExceedCount: c,
  onClickCollapseButton: u
}) {
  const { widthList: a, leftList: d } = Mi(
    n,
    r,
    Ni
  ), p = n.length - 1;
  return /* @__PURE__ */ f(Me, { children: n.map((h, m) => {
    const w = q(a[m]), y = q(d[m]), v = t.filter(tp(h)), E = Gc(v, o, Ke + 2);
    return /* @__PURE__ */ f(
      Ap,
      {
        width: w,
        left: y,
        index: m,
        exceedCount: E,
        isClicked: s,
        onClickExceedCount: c,
        isClickedIndex: m === i,
        onClickCollapseButton: u,
        isLastCell: m === p
      },
      `panel-grid-${h.getDate()}`
    );
  }) });
});
function Rp({ onMouseDown: e }) {
  return /* @__PURE__ */ f(
    "span",
    {
      className: `${_("weekday-resize-handle")} ${_("handle-y")}`,
      onMouseDown: e,
      "data-testid": "horizontal-event-resize-icon",
      children: /* @__PURE__ */ f("i", { className: `${_("icon")} ${_("ic-handle-y")}` })
    }
  );
}
const Jc = kr(null), xp = Jc.Provider, At = () => {
  const e = Nn(Jc);
  if (Ze(e))
    throw new Error("LayoutContainerProvider is not found");
  return e;
}, Op = {
  panelResizer: "panelResizer"
}, Rn = {
  resizeEvent: (e, t) => `event/${e}/resize/${t}`,
  moveEvent: (e, t) => `event/${e}/move/${t}`,
  gridSelection: (e) => `gridSelection/${e}`
};
function Qc(e) {
  return G(
    J(
      (t) => t.calendar.calendars.find((n) => n.id === e),
      [e]
    )
  );
}
function Pi(e) {
  var n;
  const t = Qc((n = e == null ? void 0 : e.calendarId) != null ? n : null);
  return U(
    () => ({
      color: t == null ? void 0 : t.color,
      borderColor: t == null ? void 0 : t.borderColor,
      backgroundColor: t == null ? void 0 : t.backgroundColor,
      dragBackgroundColor: t == null ? void 0 : t.dragBackgroundColor
    }),
    [t]
  );
}
var el = /* @__PURE__ */ ((e) => (e.ESCAPE = "Escape", e))(el || {});
const Pp = {
  Escape: 27
}, pa = 3;
function vt(e, t) {
  const n = Tc(), r = ee(e), o = ee(t);
  re(() => {
    r.current = e, o.current = t;
  }, [e, t]), re(
    () => n.subscribe(
      (i) => o.current(i),
      (i) => r.current(i)
    ),
    [e, n]
  );
}
function Lp(e, t) {
  return e.key ? e.key === t : e.keyCode === Pp[t];
}
function Hp(e) {
  return e === 0;
}
function $p(e, t, n, r) {
  return Math.abs(e - n) >= pa || Math.abs(t - r) >= pa;
}
function Qt(e, { onInit: t, onDragStart: n, onDrag: r, onMouseUp: o, onPressESCKey: i } = {}) {
  const { initDrag: s, setDragging: c, cancelDrag: u, reset: l } = _e("dnd"), a = Tc(), d = ee(a.getState().dnd);
  vt(Mt, (D) => {
    d.current = D;
  });
  const [p, h] = se(!1), m = ee(null), w = ee(null), y = ee(null), v = J(
    (D) => {
      Hp(D.button) && (D.currentTarget && (D.currentTarget.ondragstart = function() {
        return !1;
      }), D.preventDefault(), h(!0), s({
        draggingItemType: e,
        initX: D.clientX,
        initY: D.clientY
      }), t == null || t(D, d.current));
    },
    [t, e, s]
  ), E = J(
    (D) => {
      const {
        initX: N,
        initY: M,
        draggingState: H,
        draggingItemType: $
      } = d.current;
      if ($ !== e) {
        h(!1), l();
        return;
      }
      if (!(x(N) && x(M) && !$p(N, M, D.clientX, D.clientY))) {
        if (H <= ze.INIT) {
          c({ x: D.clientX, y: D.clientY }), n == null || n(D, d.current);
          return;
        }
        c({ x: D.clientX, y: D.clientY }), r == null || r(D, d.current);
      }
    },
    [e, r, n, c, l]
  ), T = J(
    (D) => {
      D.stopPropagation(), p && (o == null || o(D, d.current), h(!1), l());
    },
    [p, o, l]
  ), k = J(
    (D) => {
      Lp(D, el.ESCAPE) && (h(!1), u(), i == null || i(D, d.current));
    },
    [i, u]
  );
  return re(() => {
    m.current = E, w.current = T, y.current = k;
  }, [k, E, T]), re(() => {
    const D = (H) => {
      var $;
      return ($ = m.current) == null ? void 0 : $.call(m, H);
    }, N = (H) => {
      var $;
      return ($ = w.current) == null ? void 0 : $.call(w, H);
    }, M = (H) => {
      var $;
      return ($ = y.current) == null ? void 0 : $.call(y, H);
    };
    return p ? (document.addEventListener("mousemove", D), document.addEventListener("mouseup", N), document.addEventListener("keydown", M), () => {
      document.removeEventListener("mousemove", D), document.removeEventListener("mouseup", N), document.removeEventListener("keydown", M);
    }) : sn;
  }, [p, l]), v;
}
function Li(e, t) {
  return e ? t : void 0;
}
function tl(e) {
  return {
    vertical: e ? 5 : 2,
    horizontal: 8
  };
}
function Bp(e, t) {
  const n = e ? 0 : "2px", r = t ? 0 : "2px";
  return `${n} ${r} ${r} ${n}`;
}
function Fp({
  uiModel: e,
  flat: t,
  eventHeight: n,
  isDraggingTarget: r,
  calendarColor: o
}) {
  const { exceedLeft: i, exceedRight: s } = e, { color: c, backgroundColor: u, dragBackgroundColor: l, borderColor: a } = cc(
    e,
    o
  ), d = {
    color: c,
    backgroundColor: r ? l : u,
    borderLeft: i ? "none" : `3px solid ${a}`,
    borderRadius: Bp(i, s),
    overflow: "hidden",
    height: n,
    lineHeight: _r(n),
    opacity: r ? 0.5 : 1
  }, p = tl(t);
  return R(t ? {
    marginTop: p.vertical
  } : {
    marginLeft: i ? 0 : p.horizontal,
    marginRight: s ? 0 : p.horizontal
  }, d);
}
function Gp({
  flat: e,
  uiModel: t,
  resizingWidth: n,
  movingLeft: r,
  eventHeight: o,
  headerHeight: i
}) {
  const { top: s, left: c, width: u, model: l } = t, a = tl(e), d = e ? {} : {
    width: n || q(u),
    left: q(r != null ? r : c),
    top: (s - 1) * (o + a.vertical) + i,
    position: "absolute"
  };
  return Object.assign(d, l.customStyle);
}
function Up({ model: e }) {
  const t = e.calendarId ? `${e.calendarId}-` : "", n = e.id ? `${e.id}-` : "";
  return `${t}${n}${e.title}`;
}
const et = {
  eventBody: _("weekday-event"),
  eventTitle: _("weekday-event-title"),
  eventDot: _("weekday-event-dot"),
  moveEvent: _("dragging--move-event"),
  resizeEvent: _("dragging--resize-horizontal-event")
};
function yt({
  flat: e = !1,
  uiModel: t,
  eventHeight: n,
  headerHeight: r,
  resizingWidth: o = null,
  movingLeft: i = null
}) {
  const { currentView: s } = G(an), { useDetailPopup: c, isReadOnly: u } = G(We), { setDraggingEventUIModel: l } = _e("dnd"), { showDetailPopup: a } = _e("popup"), d = At(), p = Ce(), h = Pi(t.model), [m, w] = se(!1), y = ee(null), { isReadOnly: v, id: E, calendarId: T } = t.model, k = x(o) || x(i), D = !u && !v && !k, N = (W) => {
    l(t), d == null || d.classList.add(W);
  }, M = (W) => {
    w(!1), d == null || d.classList.remove(W);
  };
  vt(Mt, ({ draggingEventUIModel: W, draggingState: te }) => {
    te === ze.DRAGGING && (W == null ? void 0 : W.cid()) === t.cid() && !k ? w(!0) : w(!1);
  }), re(() => {
    k || p.fire("afterRenderEvent", t.model.toEventObject());
  }, []);
  const H = Qt(Rn.resizeEvent("dayGrid", `${t.cid()}`), {
    onDragStart: () => N(et.resizeEvent),
    onMouseUp: () => M(et.resizeEvent),
    onPressESCKey: () => M(et.resizeEvent)
  }), $ = Qt(Rn.moveEvent("dayGrid", `${t.cid()}`), {
    onDragStart: () => {
      D && N(et.moveEvent);
    },
    onMouseUp: (W, { draggingState: te }) => {
      M(et.moveEvent);
      const he = te <= ze.INIT;
      he && c && y.current && a(
        {
          event: t.model,
          eventRect: y.current.getBoundingClientRect()
        },
        e
      ), he && p.fire("clickEvent", { event: t.model.toEventObject(), nativeEvent: W });
    },
    onPressESCKey: () => M(et.moveEvent)
  }), Y = (W) => {
    W.stopPropagation(), D && H(W);
  }, B = (W) => {
    W.stopPropagation(), $(W);
  }, X = !m && s === "month" && t.model.category === "time" && kt(t.model.start, t.model.end), Q = !D || e || m || t.exceedRight, S = Gp({
    uiModel: t,
    eventHeight: n,
    headerHeight: r,
    flat: e,
    movingLeft: i,
    resizingWidth: o
  }), b = Fp({
    uiModel: t,
    flat: e,
    eventHeight: n,
    isDraggingTarget: m,
    calendarColor: h
  });
  return /* @__PURE__ */ f(
    "div",
    {
      className: _("weekday-event-block", {
        "weekday-exceed-left": t.exceedLeft,
        "weekday-exceed-right": t.exceedRight
      }),
      style: S,
      "data-testid": Li(D, Up(t)),
      "data-calendar-id": T,
      "data-event-id": E,
      ref: y,
      children: /* @__PURE__ */ f(
        "div",
        {
          className: et.eventBody,
          style: ae(R({}, b), {
            backgroundColor: X ? null : b.backgroundColor,
            borderLeft: X ? null : b.borderLeft
          }),
          onMouseDown: B,
          children: [
            X ? /* @__PURE__ */ f(
              "span",
              {
                className: et.eventDot,
                style: { backgroundColor: b.backgroundColor }
              }
            ) : null,
            /* @__PURE__ */ f("span", { className: et.eventTitle, children: /* @__PURE__ */ f(ne, { template: t.model.category, param: t.model }) }),
            Q ? null : /* @__PURE__ */ f(Rp, { onMouseDown: Y })
          ]
        }
      )
    }
  );
}
function ln(e, t) {
  const n = ee(e);
  re(() => {
    n.current = e;
  }, [e]), re(() => {
    t && n.current();
  }, [t]);
}
function un(e) {
  const [t, n] = se(null);
  vt(Mt, (o) => {
    if (x(o.x) && x(o.y)) {
      const i = e({
        clientX: o.x,
        clientY: o.y
      });
      i && n(i);
    }
  });
  const r = J(() => n(null), []);
  return [t, r];
}
const zp = (e, t, n) => {
  function r(o) {
    return new RegExp(`^event/${t}/${n}/\\d+$`).test(o);
  }
  return z(e) ? null : r(e) ? rt(e.split("/")) : null;
};
function dn(e, t) {
  const [n, r] = se(!1), [o, i] = se(!1), [s, c] = se(null);
  return vt(Mt, ({ draggingItemType: l, draggingEventUIModel: a, draggingState: d }) => {
    const p = zp(l, e, t), h = Number(p) === (a == null ? void 0 : a.cid()), m = d === ze.IDLE, w = d === ze.CANCELED;
    z(s) && h && c(a), x(s) && (m || w) && (r(!0), i(w));
  }), {
    isDraggingEnd: n,
    isDraggingCanceled: o,
    draggingEvent: s,
    clearDraggingEvent: () => {
      c(null), r(!1), i(!1);
    }
  };
}
function Wp({ rowStyleInfo: e, gridPositionFinder: t }) {
  const n = Ce(), {
    isDraggingEnd: r,
    isDraggingCanceled: o,
    draggingEvent: i,
    clearDraggingEvent: s
  } = dn("dayGrid", "move"), c = ee(null), [u, l] = un(t), { columnIndex: a } = u != null ? u : {}, d = U(
    () => z(i) ? null : e.findIndex(({ left: h }) => h === i.left),
    [e, i]
  ), p = U(() => {
    if (z(a) || z(c.current) || z(d))
      return null;
    const h = d + a - c.current;
    return h < 0 ? -e[-h].left : e[h].left;
  }, [a, e, d]);
  return re(() => {
    z(c.current) && x(a) && (c.current = a);
  }, [a]), ln(() => {
    if (!o && x(i) && x(a) && x(p) && a !== c.current && x(c.current)) {
      const m = a - c.current, w = new O(i.model.getStarts()), y = new O(i.model.getEnds());
      w.addDate(m), y.addDate(m), n.fire("beforeUpdateEvent", {
        event: i.model.toEventObject(),
        changes: {
          start: w,
          end: y
        }
      });
    }
    s(), l(), c.current = null;
  }, r), U(
    () => ({
      movingEvent: i,
      movingLeft: p
    }),
    [p, i]
  );
}
function Yp({
  rowStyleInfo: e,
  gridPositionFinder: t
}) {
  const { movingEvent: n, movingLeft: r } = Wp({
    rowStyleInfo: e,
    gridPositionFinder: t
  });
  return z(n) ? null : /* @__PURE__ */ f(
    yt,
    {
      uiModel: n,
      eventHeight: Ke,
      headerHeight: 0,
      movingLeft: r
    }
  );
}
function Vp(e, t) {
  const n = Tr(e.getStarts(), t), r = Tr(e.getEnds(), t);
  return { start: n, end: r };
}
function jp({
  weekDates: e,
  gridColWidthMap: t,
  gridPositionFinder: n
}) {
  const r = Ce(), {
    isDraggingEnd: o,
    isDraggingCanceled: i,
    draggingEvent: s,
    clearDraggingEvent: c
  } = dn("dayGrid", "resize"), [u, l] = un(n), { columnIndex: a } = u != null ? u : {}, d = U(() => s ? Vp(s, e) : { start: -1, end: -1 }, [e, s]), p = U(() => d.start > -1 && x(a) ? t[d.start][a] : null, [a, t, d.start]);
  return ln(() => {
    if (!i && x(s) && x(a) && d.start <= a && d.end !== a) {
      const m = e[a];
      r.fire("beforeUpdateEvent", {
        event: s.model.toEventObject(),
        changes: { end: m }
      });
    }
    l(), c();
  }, o), U(
    () => ({
      resizingEvent: s,
      resizingWidth: p
    }),
    [p, s]
  );
}
function qp({ weekDates: e, gridColWidthMap: t, gridPositionFinder: n }) {
  const { resizingEvent: r, resizingWidth: o } = jp({
    weekDates: e,
    gridColWidthMap: t,
    gridPositionFinder: n
  });
  return z(r) ? null : /* @__PURE__ */ f(
    yt,
    {
      uiModel: r,
      eventHeight: Ke,
      headerHeight: 0,
      resizingWidth: o
    }
  );
}
function He() {
  const [e, t] = se(null), n = J((r) => {
    r && t(r);
  }, []);
  return [e, n];
}
function nl(e, t) {
  const [n, r] = se(0), [o, i] = se(!1), { updateDayGridRowHeight: s } = _e("weekViewLayout"), c = J(
    (l) => {
      i(!0), r(l), s({
        rowName: t,
        height: (e + 1) * Ke
      });
    },
    [t, e, s]
  ), u = J(() => {
    i(!1), s({
      rowName: t,
      height: Zt
    });
  }, [t, s]);
  return {
    clickedIndex: n,
    isClickedCount: o,
    onClickExceedCount: c,
    onClickCollapseButton: u
  };
}
function Xp(e, t, n) {
  let r;
  const o = (s) => {
    if (r || (r = s), s - r >= t) {
      e(), n(sn);
      return;
    }
    const u = requestAnimationFrame(o);
    n(() => cancelAnimationFrame(u));
  }, i = requestAnimationFrame(o);
  n(() => cancelAnimationFrame(i));
}
function Kp({
  onClick: e,
  onDblClick: t,
  delay: n = 300
}) {
  const r = ee(sn), o = (u) => {
    r.current = u;
  }, i = () => {
    r.current();
  };
  return re(() => i, []), [(u) => {
    i(), Xp(e.bind(null, u), n, o);
  }, (u) => {
    i(), t(u);
  }];
}
const Zp = {
  dayGridMonth: "month",
  dayGridWeek: "allday",
  timeGrid: "time"
};
function Jp(e, t) {
  return e < t ? [e, t] : [t, e];
}
function Hi({
  type: e,
  selectionSorter: t,
  dateGetter: n,
  dateCollection: r,
  gridPositionFinder: o
}) {
  const { useFormPopup: i, gridSelection: s } = G(We), { enableDblClick: c, enableClick: u } = s, { setGridSelection: l, addGridSelection: a, clearAll: d } = _e("gridSelection"), { hideAllPopup: p, showFormPopup: h } = _e("popup"), m = Ce(), w = At(), [y, v] = se(null), [E, T] = se(null), k = ee(!1), D = ee(null);
  vt(
    J((S) => S.gridSelection[e], [e]),
    (S) => {
      D.current = S;
    }
  ), vt(Mt, ({ draggingState: S, draggingItemType: b }) => {
    k.current = b === N && S >= ze.INIT;
  });
  const N = Rn.gridSelection(e), M = (S) => {
    const b = o(S);
    x(E) && x(b) && l(e, t(E, b));
  }, [H, $] = Kp({
    onClick: (S) => {
      u && B(S, !0);
    },
    onDblClick: (S) => {
      c && B(S, !0);
    },
    delay: 250
    // heuristic value
  }), Y = (S) => {
    const b = S.detail <= 1;
    if (!(!u && (!c || b))) {
      if (u) {
        b ? H(S) : $(S);
        return;
      }
      B(S, !0);
    }
  }, B = (S, b) => {
    var W;
    if (b && M(S), x(D.current)) {
      const [te, he] = Jp(
        ...n(r, D.current)
      );
      if (i && x(y)) {
        const Re = {
          top: (S.clientY + y.y) / 2,
          left: (S.clientX + y.x) / 2
        };
        h({
          isCreationPopup: !0,
          title: "",
          location: "",
          start: te,
          end: he,
          isAllday: e !== "timeGrid",
          isPrivate: !1,
          popupArrowPointPosition: Re,
          close: d
        });
      }
      const j = `.${_(Zp[e])}.${_(
        "grid-selection"
      )}`, le = Array.from(
        (W = w == null ? void 0 : w.querySelectorAll(j)) != null ? W : []
      );
      m.fire("selectDateTime", {
        start: te.toDate(),
        end: he.toDate(),
        isAllday: e !== "timeGrid",
        nativeEvent: S,
        gridSelectionElements: le
      });
    }
  }, X = J(() => {
    v(null), T(null), l(e, null);
  }, [l, e]), Q = Qt(N, {
    onInit: (S) => {
      i && (v({
        x: S.clientX,
        y: S.clientY
      }), p());
      const b = o(S);
      x(b) && T(b), i || a(e, D.current);
    },
    onDragStart: (S) => {
      M(S);
    },
    onDrag: (S) => {
      k.current && M(S);
    },
    onMouseUp: (S, { draggingState: b }) => {
      S.stopPropagation();
      const W = b <= ze.INIT;
      W ? Y(S) : B(S, W);
    },
    onPressESCKey: X
  });
  return re(() => X, [X]), Q;
}
const Qp = "alldayTitle";
function rl({
  events: e,
  weekDates: t,
  height: n = Zt,
  options: r = {},
  rowStyleInfo: o,
  gridColWidthMap: i
}) {
  const { isReadOnly: s } = G(We), c = ie(Mc), [u, l] = He(), { narrowWeekend: a = !1, startDayOfWeek: d = rn.SUN } = r, p = U(() => Math.max(0, ...e.map(({ top: D }) => D)), [e]), h = U(
    () => Ai({
      container: u,
      rowsCount: 1,
      columnsCount: t.length,
      narrowWeekend: a,
      startDayOfWeek: d
    }),
    [u, t.length, a, d]
  ), { clickedIndex: m, isClickedCount: w, onClickExceedCount: y, onClickCollapseButton: v } = nl(p, "allday"), E = U(
    () => e.filter(Ii(n, Ke + ic)).map((D) => /* @__PURE__ */ f(
      yt,
      {
        uiModel: D,
        eventHeight: Ke,
        headerHeight: 0
      },
      `allday-DayEvent-${D.cid()}`
    )),
    [e, n]
  ), T = Hi({
    type: "dayGridWeek",
    gridPositionFinder: h,
    dateCollection: t,
    selectionSorter: Qo.sortSelection,
    dateGetter: Qo.getDateFromCollection
  }), k = (D) => {
    const N = D.target;
    s || !N.classList.contains(_("panel-grid")) || T(D);
  };
  return /* @__PURE__ */ f(Me, { children: [
    /* @__PURE__ */ f("div", { className: _("panel-title"), style: c, children: /* @__PURE__ */ f(ne, { template: Qp, param: "alldayTitle" }) }),
    /* @__PURE__ */ f("div", { className: _("allday-panel"), ref: l, onMouseDown: k, children: [
      /* @__PURE__ */ f("div", { className: _("panel-grid-wrapper"), children: /* @__PURE__ */ f(
        Zc,
        {
          uiModels: e,
          weekDates: t,
          narrowWeekend: a,
          height: n,
          clickedIndex: m,
          isClickedCount: w,
          onClickExceedCount: y,
          onClickCollapseButton: v
        }
      ) }),
      /* @__PURE__ */ f("div", { className: _("panel-allday-events"), children: E }),
      /* @__PURE__ */ f(
        qp,
        {
          weekDates: t,
          gridPositionFinder: h,
          gridColWidthMap: i
        }
      ),
      /* @__PURE__ */ f(Yp, { rowStyleInfo: o, gridPositionFinder: h }),
      /* @__PURE__ */ f(gp, { weekDates: t, narrowWeekend: a })
    ] })
  ] });
}
function ol({
  events: e,
  weekDates: t,
  category: n,
  height: r = Zt,
  options: o = {}
}) {
  const i = ie(Mc), s = U(() => Math.max(0, ...e.map(({ top: m }) => m)), [e]), { narrowWeekend: c = !1 } = o, u = `${n}Title`, { clickedIndex: l, isClickedCount: a, onClickExceedCount: d, onClickCollapseButton: p } = nl(s, n), h = U(
    () => e.filter(Ii(r, Ke + ic)).map((m) => /* @__PURE__ */ f(
      yt,
      {
        uiModel: m,
        eventHeight: Ke,
        headerHeight: 0
      },
      `${n}-DayEvent-${m.cid()}`
    )),
    [n, e, r]
  );
  return /* @__PURE__ */ f(Me, { children: [
    /* @__PURE__ */ f("div", { className: _("panel-title"), style: i, children: /* @__PURE__ */ f(ne, { template: u, param: n }) }),
    /* @__PURE__ */ f("div", { className: _("allday-panel"), children: [
      /* @__PURE__ */ f("div", { className: _("panel-grid-wrapper"), children: /* @__PURE__ */ f(
        Zc,
        {
          uiModels: e,
          weekDates: t,
          narrowWeekend: c,
          height: r,
          clickedIndex: l,
          isClickedCount: a,
          onClickExceedCount: d,
          onClickCollapseButton: p
        }
      ) }),
      /* @__PURE__ */ f("div", { className: _(`panel-${n}-events`), children: h })
    ] })
  ] });
}
const ge = {
  detailItem: _("detail-item"),
  detailItemIndent: _("detail-item", "detail-item-indent"),
  detailItemSeparate: _("detail-item", "detail-item-separate"),
  sectionDetail: _("popup-section", "section-detail"),
  content: _("content"),
  locationIcon: _("icon", "ic-location-b"),
  repeatIcon: _("icon", "ic-repeat-b"),
  userIcon: _("icon", "ic-user-b"),
  stateIcon: _("icon", "ic-state-b"),
  calendarDotIcon: _("icon", "calendar-dot")
};
function eh({ event: e }) {
  var u, l;
  const { location: t, recurrenceRule: n, attendees: r, state: o, calendarId: i, body: s } = e, c = Qc(i);
  return /* @__PURE__ */ f("div", { className: ge.sectionDetail, children: [
    t && /* @__PURE__ */ f("div", { className: ge.detailItem, children: [
      /* @__PURE__ */ f("span", { className: ge.locationIcon }),
      /* @__PURE__ */ f("span", { className: ge.content, children: /* @__PURE__ */ f(ne, { template: "popupDetailLocation", param: e, as: "span" }) })
    ] }),
    n && /* @__PURE__ */ f("div", { className: ge.detailItem, children: [
      /* @__PURE__ */ f("span", { className: ge.repeatIcon }),
      /* @__PURE__ */ f("span", { className: ge.content, children: /* @__PURE__ */ f(ne, { template: "popupDetailRecurrenceRule", param: e, as: "span" }) })
    ] }),
    r && /* @__PURE__ */ f("div", { className: ge.detailItemIndent, children: [
      /* @__PURE__ */ f("span", { className: ge.userIcon }),
      /* @__PURE__ */ f("span", { className: ge.content, children: /* @__PURE__ */ f(ne, { template: "popupDetailAttendees", param: e, as: "span" }) })
    ] }),
    o && /* @__PURE__ */ f("div", { className: ge.detailItem, children: [
      /* @__PURE__ */ f("span", { className: ge.stateIcon }),
      /* @__PURE__ */ f("span", { className: ge.content, children: /* @__PURE__ */ f(ne, { template: "popupDetailState", param: e, as: "span" }) })
    ] }),
    c && /* @__PURE__ */ f("div", { className: ge.detailItem, children: [
      /* @__PURE__ */ f(
        "span",
        {
          className: ge.calendarDotIcon,
          style: {
            backgroundColor: (u = c == null ? void 0 : c.backgroundColor) != null ? u : ""
          }
        }
      ),
      /* @__PURE__ */ f("span", { className: ge.content, children: (l = c == null ? void 0 : c.name) != null ? l : "" })
    ] }),
    s && /* @__PURE__ */ f("div", { className: ge.detailItemSeparate, children: /* @__PURE__ */ f("span", { className: ge.content, children: /* @__PURE__ */ f(ne, { template: "popupDetailBody", param: e, as: "span" }) }) })
  ] });
}
const To = {
  sectionHeader: _("popup-section", "section-header"),
  content: _("content"),
  eventTitle: _("event-title")
};
function th({ event: e }) {
  return /* @__PURE__ */ f("div", { className: To.sectionHeader, children: [
    /* @__PURE__ */ f("div", { className: To.eventTitle, children: /* @__PURE__ */ f(ne, { template: "popupDetailTitle", param: e, as: "span" }) }),
    /* @__PURE__ */ f("div", { className: To.content, children: /* @__PURE__ */ f(ne, { template: "popupDetailDate", param: e, as: "span" }) })
  ] });
}
const nh = _("see-more-popup-slot"), rh = _("event-form-popup-slot"), oh = _("event-detail-popup-slot"), ti = 8, ih = [
  "isPrivate",
  "isAllday",
  "isPending",
  "isFocused",
  "isVisible",
  "isReadOnly"
];
var Wt = /* @__PURE__ */ ((e) => (e.right = "right", e.left = "left", e))(Wt || {}), Yt = /* @__PURE__ */ ((e) => (e.top = "top", e.bottom = "bottom", e))(Yt || {});
const il = kr(null);
function sh({ children: e }) {
  const [t, n] = He(), [r, o] = He(), [i, s] = He(), [c, u] = He(), l = {
    container: t,
    seeMorePopupSlot: r,
    formPopupSlot: i,
    detailPopupSlot: c
  };
  return /* @__PURE__ */ f(il.Provider, { value: l, children: [
    e,
    /* @__PURE__ */ f("div", { ref: n, className: _("floating-layer"), children: [
      /* @__PURE__ */ f("div", { ref: o, className: nh }),
      /* @__PURE__ */ f("div", { ref: s, className: rh }),
      /* @__PURE__ */ f("div", { ref: u, className: oh })
    ] })
  ] });
}
const $i = (e) => {
  var n;
  const t = Nn(il);
  if (Ze(t))
    throw new Error("FloatingLayerProvider is not found");
  return (n = t == null ? void 0 : t[e]) != null ? n : null;
};
function sl(e, t, n) {
  return e + n.height > t.top + t.height;
}
function al(e, t, n) {
  return e + n.width > t.left + t.width;
}
const ah = (e) => e.popup[Or.Form], ch = (e) => e.popup[Or.Detail], lh = (e) => e.popup[Or.SeeMore], Oe = {
  popupContainer: _("popup-container"),
  detailContainer: _("detail-container"),
  topLine: _("popup-top-line"),
  border: _("popup-arrow-border"),
  fill: _("popup-arrow-fill"),
  sectionButton: _("popup-section", "section-button"),
  content: _("content"),
  editIcon: _("icon", "ic-edit"),
  deleteIcon: _("icon", "ic-delete"),
  editButton: _("edit-button"),
  deleteButton: _("delete-button"),
  verticalLine: _("vertical-line")
};
function uh(e, t, n) {
  let r = e.top + e.height / 2 - n.height / 2, o = e.left + e.width;
  return sl(r, t, n) && (r = t.top + t.height - n.height), al(o, t, n) && (o = e.left - n.width), [
    Math.max(r, t.top) + window.scrollY,
    Math.max(o, t.left) + window.scrollX
  ];
}
function dh(e, t, n) {
  const r = e.top + e.height / 2 + window.scrollY, s = e.left + e.width + n.width > t.left + t.width ? Wt.right : Wt.left;
  return { top: r, direction: s };
}
function fh() {
  const { useFormPopup: e } = G(We), t = G(ch), { event: n, eventRect: r } = t != null ? t : {}, { showFormPopup: o, hideDetailPopup: i } = _e("popup"), s = Pi(n), c = At(), u = $i("detailPopupSlot"), l = Ce(), a = ee(null), [d, p] = se({}), [h, m] = se(0), [w, y] = se(
    Wt.left
  ), v = U(() => {
    const Q = w === Wt.right, S = w === Wt.left;
    return _("popup-arrow", { right: Q, left: S });
  }, [w]);
  if (ht(() => {
    if (a.current && r && c) {
      const Q = c.getBoundingClientRect(), S = a.current.getBoundingClientRect(), [b, W] = uh(r, Q, S), { top: te, direction: he } = dh(
        r,
        Q,
        S
      );
      p({ top: b, left: W }), m(te - b - ti), y(he);
    }
  }, [r, c]), z(n) || z(r) || z(u))
    return null;
  const {
    title: E = "",
    isAllday: T = !1,
    start: k = new O(),
    end: D = new O(),
    location: N,
    state: M,
    isReadOnly: H,
    isPrivate: $
  } = n, Y = {
    top: r.top + r.height / 2,
    left: r.left + r.width / 2
  }, B = () => {
    e ? o({
      isCreationPopup: !1,
      event: n,
      title: E,
      location: N,
      start: k,
      end: D,
      isAllday: T,
      isPrivate: $,
      eventState: M,
      popupArrowPointPosition: Y
    }) : l.fire("beforeUpdateEvent", { event: n.toEventObject(), changes: {} });
  }, X = () => {
    l.fire("beforeDeleteEvent", n.toEventObject()), i();
  };
  return Oi(
    /* @__PURE__ */ f("div", { role: "dialog", className: Oe.popupContainer, ref: a, style: d, children: [
      /* @__PURE__ */ f("div", { className: Oe.detailContainer, children: [
        /* @__PURE__ */ f(th, { event: n }),
        /* @__PURE__ */ f(eh, { event: n }),
        !H && /* @__PURE__ */ f("div", { className: Oe.sectionButton, children: [
          /* @__PURE__ */ f("button", { type: "button", className: Oe.editButton, onClick: B, children: [
            /* @__PURE__ */ f("span", { className: Oe.editIcon }),
            /* @__PURE__ */ f("span", { className: Oe.content, children: /* @__PURE__ */ f(ne, { template: "popupEdit", as: "span" }) })
          ] }),
          /* @__PURE__ */ f("div", { className: Oe.verticalLine }),
          /* @__PURE__ */ f("button", { type: "button", className: Oe.deleteButton, onClick: X, children: [
            /* @__PURE__ */ f("span", { className: Oe.deleteIcon }),
            /* @__PURE__ */ f("span", { className: Oe.content, children: /* @__PURE__ */ f(ne, { template: "popupDelete", as: "span" }) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ f(
        "div",
        {
          className: Oe.topLine,
          style: { backgroundColor: s.backgroundColor }
        }
      ),
      /* @__PURE__ */ f("div", { className: v, children: /* @__PURE__ */ f("div", { className: Oe.border, style: { top: h }, children: /* @__PURE__ */ f("div", { className: Oe.fill }) }) })
    ] }),
    u
  );
}
const lr = {
  dropdownMenu: _("dropdown-menu"),
  dropdownMenuItem: _("dropdown-menu-item"),
  dotIcon: _("icon", "dot"),
  content: _("content")
};
function ph({ index: e, name: t, backgroundColor: n, onClick: r }) {
  return /* @__PURE__ */ f("li", { className: lr.dropdownMenuItem, onClick: (o) => r(o, e), children: [
    /* @__PURE__ */ f("span", { className: lr.dotIcon, style: { backgroundColor: n } }),
    /* @__PURE__ */ f("span", { className: lr.content, children: t })
  ] });
}
function hh({ calendars: e, setOpened: t, onChangeIndex: n }) {
  const r = (o, i) => {
    o.stopPropagation(), t(!1), n(i);
  };
  return /* @__PURE__ */ f("ul", { className: lr.dropdownMenu, children: e.map(({ name: o, backgroundColor: i = "000" }, s) => /* @__PURE__ */ f(
    ph,
    {
      index: s,
      name: o,
      backgroundColor: i,
      onClick: r
    },
    `dropdown-${o}-${s}`
  )) });
}
function It({
  children: e,
  classNames: t = [],
  onClick: n = sn
}) {
  return /* @__PURE__ */ f("div", { className: _("popup-section", ...t), onClick: n, children: e });
}
function cl() {
  const [e, t] = se(!1);
  return { isOpened: e, setOpened: t, toggleDropdown: () => t((r) => !r) };
}
var it = /* @__PURE__ */ ((e) => (e.init = "init", e.setCalendarId = "setCalendarId", e.setTitle = "setTitle", e.setLocation = "setLocation", e.setPrivate = "setPrivate", e.setAllday = "setAllday", e.setState = "setState", e.reset = "reset", e))(it || {});
const ni = {
  title: "",
  location: "",
  isAllday: !1,
  isPrivate: !1,
  state: "Busy"
};
function mh(e, t) {
  switch (t.type) {
    case "init":
      return R(R({}, ni), t.event);
    case "setCalendarId":
      return ae(R({}, e), { calendarId: t.calendarId });
    case "setTitle":
      return ae(R({}, e), { title: t.title });
    case "setLocation":
      return ae(R({}, e), { location: t.location });
    case "setPrivate":
      return ae(R({}, e), { isPrivate: t.isPrivate });
    case "setAllday":
      return ae(R({}, e), { isAllday: t.isAllday });
    case "setState":
      return ae(R({}, e), { state: t.state });
    case "reset":
      return R(R({}, e), ni);
    default:
      return e;
  }
}
function gh(e) {
  return ai(mh, R({ calendarId: e }, ni));
}
const Jn = {
  popupSection: ["dropdown-section", "calendar-section"],
  popupSectionItem: _("popup-section-item", "popup-button"),
  dotIcon: _("icon", "dot"),
  content: _("content", "event-calendar")
};
function vh({ calendars: e, selectedCalendarId: t, formStateDispatch: n }) {
  const { isOpened: r, setOpened: o, toggleDropdown: i } = cl(), s = e.find((a) => a.id === t), { backgroundColor: c = "", name: u = "" } = s != null ? s : {}, l = (a) => n({ type: it.setCalendarId, calendarId: e[a].id });
  return /* @__PURE__ */ f(It, { onClick: i, classNames: Jn.popupSection, children: [
    /* @__PURE__ */ f("button", { type: "button", className: Jn.popupSectionItem, children: [
      /* @__PURE__ */ f("span", { className: Jn.dotIcon, style: { backgroundColor: c } }),
      /* @__PURE__ */ f("span", { className: Jn.content, children: u }),
      /* @__PURE__ */ f("span", { className: _("icon", "ic-dropdown-arrow", { open: r }) })
    ] }),
    r && /* @__PURE__ */ f(
      hh,
      {
        calendars: e,
        setOpened: o,
        onChangeIndex: l
      }
    )
  ] });
}
const ha = {
  closeButton: _("popup-button", "popup-close"),
  closeIcon: _("icon", "ic-close")
};
function ll({ type: e, close: t }) {
  const { hideAllPopup: n } = _e("popup"), r = () => {
    n(), bn(t) && t();
  };
  return /* @__PURE__ */ f("button", { type: "button", className: ha.closeButton, onClick: r, children: e === "moreEvents" ? /* @__PURE__ */ f(ne, { template: "monthMoreClose" }) : /* @__PURE__ */ f("i", { className: ha.closeIcon }) });
}
const _h = {
  confirmButton: _("popup-button", "popup-confirm")
};
function yh({ children: e }) {
  return /* @__PURE__ */ f("button", { type: "submit", className: _h.confirmButton, children: /* @__PURE__ */ f("span", { children: e }) });
}
function Cr({
  template: e,
  model: t,
  defaultValue: n = ""
}) {
  const o = G(Cc)[e];
  if (z(o))
    return n;
  let i = o(t);
  return be(i) || (i = n), i;
}
const Fe = {
  datePickerContainer: _("datepicker-container"),
  datePicker: _("popup-section-item", "popup-date-picker"),
  allday: _("popup-section-item", "popup-section-allday"),
  dateIcon: _("icon", "ic-date"),
  dateDash: _("popup-date-dash"),
  content: _("content")
}, wh = Xc(function({ start: t, end: n, isAllday: r = !1, formStateDispatch: o }, i) {
  const { usageStatistics: s } = G(We), c = ee(null), u = ee(null), l = ee(null), a = ee(null), d = Cr({
    template: "startDatePlaceholder",
    defaultValue: "Start Date"
  }), p = Cr({
    template: "endDatePlaceholder",
    defaultValue: "End Date"
  }), h = () => o({ type: it.setAllday, isAllday: !r });
  return re(() => {
    if (c.current && u.current && l.current && a.current) {
      const m = new O(t), w = new O(n);
      r && (m.setHours(12, 0, 0), w.setHours(13, 0, 0)), i.current = cu.createRangePicker({
        startpicker: {
          date: m.toDate(),
          input: u.current,
          container: c.current
        },
        endpicker: {
          date: w.toDate(),
          input: a.current,
          container: l.current
        },
        format: r ? "yyyy-MM-dd" : "yyyy-MM-dd HH:mm",
        timePicker: r ? !1 : {
          showMeridiem: !1,
          usageStatistics: s
        },
        usageStatistics: s
      });
    }
  }, [t, n, r, s, i]), /* @__PURE__ */ f(It, { children: [
    /* @__PURE__ */ f("div", { className: Fe.datePicker, children: [
      /* @__PURE__ */ f("span", { className: Fe.dateIcon }),
      /* @__PURE__ */ f(
        "input",
        {
          name: "start",
          className: Fe.content,
          placeholder: d,
          ref: u
        }
      ),
      /* @__PURE__ */ f("div", { className: Fe.datePickerContainer, ref: c })
    ] }),
    /* @__PURE__ */ f("span", { className: Fe.dateDash, children: "-" }),
    /* @__PURE__ */ f("div", { className: Fe.datePicker, children: [
      /* @__PURE__ */ f("span", { className: Fe.dateIcon }),
      /* @__PURE__ */ f(
        "input",
        {
          name: "end",
          className: Fe.content,
          placeholder: p,
          ref: a
        }
      ),
      /* @__PURE__ */ f("div", { className: Fe.datePickerContainer, ref: l })
    ] }),
    /* @__PURE__ */ f("div", { className: Fe.allday, onClick: h, children: [
      /* @__PURE__ */ f(
        "span",
        {
          className: _("icon", {
            "ic-checkbox-normal": !r,
            "ic-checkbox-checked": r
          })
        }
      ),
      /* @__PURE__ */ f("span", { className: Fe.content, children: /* @__PURE__ */ f(ne, { template: "popupIsAllday" }) }),
      /* @__PURE__ */ f(
        "input",
        {
          name: "isAllday",
          type: "checkbox",
          className: _("hidden-input"),
          value: r ? "true" : "false",
          checked: r
        }
      )
    ] })
  ] });
}), Eh = ["Busy", "Free"], Qn = {
  popupSectionItem: _("popup-section-item", "dropdown-menu-item"),
  dropdownMenu: _("dropdown-menu"),
  icon: _("icon"),
  content: _("content")
};
function Dh({ setOpened: e, setEventState: t }) {
  const n = (r, o) => {
    r.stopPropagation(), e(!1), t(o);
  };
  return /* @__PURE__ */ f("ul", { className: Qn.dropdownMenu, children: Eh.map((r) => /* @__PURE__ */ f(
    "li",
    {
      className: Qn.popupSectionItem,
      onClick: (o) => n(o, r),
      children: [
        /* @__PURE__ */ f("span", { className: Qn.icon }),
        /* @__PURE__ */ f("span", { className: Qn.content, children: r === "Busy" ? /* @__PURE__ */ f(ne, { template: "popupStateBusy" }) : /* @__PURE__ */ f(ne, { template: "popupStateFree" }) })
      ]
    },
    r
  )) });
}
const yn = {
  popupSection: ["dropdown-section", "state-section"],
  popupSectionItem: _("popup-section-item", "popup-button"),
  stateIcon: _("icon", "ic-state"),
  arrowIcon: _("icon", "ic-dropdown-arrow"),
  content: _("content", "event-state")
};
function Sh({ eventState: e = "Busy", formStateDispatch: t }) {
  const { isOpened: n, setOpened: r, toggleDropdown: o } = cl(), i = (s) => t({ type: it.setState, state: s });
  return /* @__PURE__ */ f(It, { onClick: o, classNames: yn.popupSection, children: [
    /* @__PURE__ */ f("button", { type: "button", className: yn.popupSectionItem, children: [
      /* @__PURE__ */ f("span", { className: yn.stateIcon }),
      /* @__PURE__ */ f("span", { className: yn.content, children: e === "Busy" ? /* @__PURE__ */ f(ne, { template: "popupStateBusy" }) : /* @__PURE__ */ f(ne, { template: "popupStateFree" }) }),
      /* @__PURE__ */ f("span", { className: yn.arrowIcon })
    ] }),
    n && /* @__PURE__ */ f(Dh, { setOpened: r, setEventState: i })
  ] });
}
const bo = {
  popupSectionItem: _("popup-section-item", "popup-section-location"),
  locationIcon: _("icon", "ic-location"),
  content: _("content")
};
function Th({ location: e, formStateDispatch: t }) {
  const n = Cr({
    template: "locationPlaceholder",
    defaultValue: "Location"
  }), r = (o) => {
    t({ type: it.setLocation, location: o.currentTarget.value });
  };
  return /* @__PURE__ */ f(It, { children: /* @__PURE__ */ f("div", { className: bo.popupSectionItem, children: [
    /* @__PURE__ */ f("span", { className: bo.locationIcon }),
    /* @__PURE__ */ f(
      "input",
      {
        name: "location",
        className: bo.content,
        placeholder: n,
        value: e,
        onChange: r
      }
    )
  ] }) });
}
const er = {
  popupSectionItem: _("popup-section-item", "popup-section-title"),
  privateButton: _("popup-section-item", "popup-section-private", "popup-button"),
  titleIcon: _("icon", "ic-title"),
  content: _("content")
};
function bh({ title: e, isPrivate: t = !1, formStateDispatch: n }) {
  const r = Cr({
    template: "titlePlaceholder",
    defaultValue: "Subject"
  }), o = () => n({ type: it.setPrivate, isPrivate: !t }), i = (s) => {
    n({ type: it.setTitle, title: s.currentTarget.value });
  };
  return /* @__PURE__ */ f(It, { children: [
    /* @__PURE__ */ f("div", { className: er.popupSectionItem, children: [
      /* @__PURE__ */ f("span", { className: er.titleIcon }),
      /* @__PURE__ */ f(
        "input",
        {
          name: "title",
          className: er.content,
          placeholder: r,
          value: e,
          onChange: i,
          required: !0
        }
      )
    ] }),
    /* @__PURE__ */ f("button", { type: "button", className: er.privateButton, onClick: o, children: [
      /* @__PURE__ */ f("span", { className: _("icon", { "ic-private": t, "ic-public": !t }) }),
      /* @__PURE__ */ f(
        "input",
        {
          name: "isPrivate",
          type: "checkbox",
          className: _("hidden-input"),
          value: t ? "true" : "false",
          checked: t
        }
      )
    ] })
  ] });
}
const tr = {
  popupContainer: _("popup-container"),
  formContainer: _("form-container"),
  popupArrowBorder: _("popup-arrow-border"),
  popupArrowFill: _("popup-arrow-fill")
};
function Ch(e, t, n) {
  let r = e.top - n.height - ti, o = e.left - n.width / 2, i = Yt.bottom;
  return r < t.top && (i = Yt.top, r = e.top + ti), sl(r, t, n) && (r = t.top + t.height - n.height), al(o, t, n) && (o = t.left + t.width - n.width), {
    top: r + window.scrollY,
    left: Math.max(o, t.left) + window.scrollX,
    direction: i
  };
}
function kh(e) {
  return ih.indexOf(e) !== -1;
}
function Nh(e, t) {
  return Object.entries(t).reduce((n, [r, o]) => {
    const i = r;
    return e[i] instanceof O ? gt(e[i], o) !== 0 && (n[i] = o) : e[i] !== o && (n[i] = o), n;
  }, {});
}
function Ih() {
  var H;
  const { calendars: e } = G(Pr), { hideAllPopup: t } = _e("popup"), n = G(ah), { start: r, end: o, popupArrowPointPosition: i, close: s, isCreationPopup: c, event: u } = n != null ? n : {}, l = Ce(), a = $i("formPopupSlot"), [d, p] = gh((H = e[0]) == null ? void 0 : H.id), h = ee(null), m = ee(null), [w, y] = se({}), [v, E] = se(0), [T, k] = se(
    Yt.bottom
  ), D = At(), N = U(() => {
    const $ = T === Yt.top, Y = T === Yt.bottom;
    return _("popup-arrow", { top: $, bottom: Y });
  }, [T]);
  if (ht(() => {
    if (m.current && i && D) {
      const $ = D.getBoundingClientRect(), Y = m.current.getBoundingClientRect(), { top: B, left: X, direction: Q } = Ch(
        i,
        $,
        Y
      ), S = i.left - X;
      y({ left: X, top: B }), E(S), k(Q);
    }
  }, [D, i]), re(() => {
    x(n) && x(u) && p({
      type: it.init,
      event: {
        title: n.title,
        location: n.location,
        isAllday: n.isAllday,
        isPrivate: n.isPrivate,
        calendarId: u.calendarId,
        state: n.eventState
      }
    });
  }, [e, u, p, n]), re(() => {
    z(n) && p({ type: it.reset });
  }, [p, n]), z(r) || z(o) || z(a))
    return null;
  const M = ($) => {
    var X, Q;
    $.preventDefault();
    const Y = new FormData($.target), B = R({}, d);
    if (Y.forEach((S, b) => {
      B[b] = kh(b) ? S === "true" : S;
    }), B.start = new O((X = h.current) == null ? void 0 : X.getStartDate()), B.end = new O((Q = h.current) == null ? void 0 : Q.getEndDate()), c)
      l.fire("beforeCreateEvent", B);
    else if (u) {
      const S = Nh(u, B);
      l.fire("beforeUpdateEvent", { event: u.toEventObject(), changes: S });
    }
    t();
  };
  return Oi(
    /* @__PURE__ */ f("div", { role: "dialog", className: tr.popupContainer, ref: m, style: w, children: /* @__PURE__ */ f("form", { onSubmit: M, children: [
      /* @__PURE__ */ f("div", { className: tr.formContainer, children: [
        e != null && e.length ? /* @__PURE__ */ f(
          vh,
          {
            selectedCalendarId: d.calendarId,
            calendars: e,
            formStateDispatch: p
          }
        ) : /* @__PURE__ */ f(It, {}),
        /* @__PURE__ */ f(
          bh,
          {
            title: d.title,
            isPrivate: d.isPrivate,
            formStateDispatch: p
          }
        ),
        /* @__PURE__ */ f(Th, { location: d.location, formStateDispatch: p }),
        /* @__PURE__ */ f(
          wh,
          {
            start: r,
            end: o,
            isAllday: d.isAllday,
            formStateDispatch: p,
            ref: h
          }
        ),
        /* @__PURE__ */ f(Sh, { eventState: d.state, formStateDispatch: p }),
        /* @__PURE__ */ f(ll, { type: "form", close: s }),
        /* @__PURE__ */ f(It, { children: /* @__PURE__ */ f(yh, { children: c ? /* @__PURE__ */ f(ne, { template: "popupSave" }) : /* @__PURE__ */ f(ne, { template: "popupUpdate" }) }) })
      ] }),
      /* @__PURE__ */ f("div", { className: N, children: /* @__PURE__ */ f("div", { className: tr.popupArrowBorder, style: { left: v }, children: /* @__PURE__ */ f("div", { className: tr.popupArrowFill }) }) })
    ] }) }),
    a
  );
}
function Mh(e) {
  return Object.values(e.popup).find((t) => x(t));
}
function Ah() {
  const e = G(Mh), { hideAllPopup: t } = _e("popup"), n = x(e), r = (o) => {
    var i;
    o.stopPropagation(), (i = e == null ? void 0 : e.close) == null || i.call(e), t();
  };
  return /* @__PURE__ */ f(
    "div",
    {
      className: _("popup-overlay"),
      style: { display: n ? "block" : "none" },
      onClick: r
    }
  );
}
const nr = {
  container: _("see-more-container"),
  seeMore: _("see-more"),
  header: _("see-more-header"),
  list: _("month-more-list")
};
function Rh() {
  const e = G(lh), { date: t, events: n = [], popupPosition: r } = e != null ? e : {}, { moreView: o, moreViewTitle: i } = Rc(), s = $i("seeMorePopupSlot"), c = Ce(), u = ee(null), l = z(t) || z(r) || z(s);
  if (re(() => {
    !l && u.current && c.fire("clickMoreEventsBtn", {
      date: t.toDate(),
      target: u.current
    });
  }, [t, c, l]), l)
    return null;
  const a = {
    height: sr,
    marginBottom: Yo,
    padding: xu,
    backgroundColor: i.backgroundColor
  }, d = {
    ymd: fe(t, "YYYY-MM-DD"),
    day: t.getDay(),
    date: t.getDate().toString().padStart(2, "0")
  }, p = {
    height: `calc(100% - ${sr + Yo + Ru}px)`
  };
  return Oi(
    /* @__PURE__ */ f(
      "div",
      {
        role: "dialog",
        className: nr.container,
        style: r,
        ref: u,
        children: /* @__PURE__ */ f("div", { className: nr.seeMore, style: o, children: [
          /* @__PURE__ */ f("div", { className: nr.header, style: a, children: [
            /* @__PURE__ */ f(ne, { template: "monthMoreTitleDate", param: d }),
            /* @__PURE__ */ f(ll, { type: "moreEvents" })
          ] }),
          /* @__PURE__ */ f("div", { className: nr.list, style: p, children: n.map((h) => /* @__PURE__ */ f(
            yt,
            {
              uiModel: h,
              eventHeight: Kt,
              headerHeight: sr,
              flat: !0
            },
            `see-more-event-item-${h.cid()}`
          )) })
        ] })
      }
    ),
    s
  );
}
function xh(e, t) {
  const n = { height: q(100) };
  return e && (n.width = e), t && (n.height = t), n;
}
function Bi({
  children: e,
  width: t,
  height: n,
  className: r = "",
  autoAdjustPanels: o = !1
}) {
  const { backgroundColor: i } = ie(Ic), [s, c] = He(), { setLastPanelType: u, updateLayoutHeight: l } = _e("weekViewLayout"), a = U(() => `${_("layout")} ${r}`, [r]);
  return ht(() => {
    if (s) {
      const d = () => l(s.offsetHeight);
      return d(), window.addEventListener("resize", d), () => window.removeEventListener("resize", d);
    }
    return sn;
  }, [s, l]), ht(() => {
    if (s && o) {
      const d = Cn(e), p = d[d.length - 1];
      !be(p) && !ar(p) && !z(p) && u(p.props.name);
    }
  }, [e, u, o, s]), /* @__PURE__ */ f(xp, { value: s, children: [
    /* @__PURE__ */ f(
      "div",
      {
        ref: c,
        className: a,
        style: ae(R({}, xh(t, n)), { backgroundColor: i }),
        children: s ? e : null
      }
    ),
    /* @__PURE__ */ f(Ih, {}),
    /* @__PURE__ */ f(fh, {}),
    /* @__PURE__ */ f(Rh, {}),
    /* @__PURE__ */ f(Ah, {})
  ] });
}
function Oh(e, t) {
  return {
    height: e,
    width: "100%",
    cursor: "row-resize",
    borderTop: t,
    borderBottom: t
  };
}
function Ph({ name: e, height: t }) {
  const n = ie(J((a) => a.week.panelResizer.border, [])), r = Oh(t, n), o = ae(R({}, r), {
    display: "none",
    border: "none",
    backgroundColor: "#999"
  }), [i, s] = se(o), c = ee(null), { updateDayGridRowHeightByDiff: u } = _e("weekViewLayout"), l = Qt(Op.panelResizer, {
    onDragStart: (a) => {
      c.current = { left: a.pageX, top: a.pageY };
    },
    onDrag: (a) => {
      if (c.current) {
        const d = a.pageY - c.current.top;
        s((p) => ae(R({}, p), { top: d, display: null }));
      }
    },
    onMouseUp: (a) => {
      if (c.current) {
        const d = a.pageY - c.current.top;
        c.current = null, s(o), u({ rowName: e, diff: d });
      }
    }
  });
  return /* @__PURE__ */ f("div", { style: { position: "relative" }, children: [
    /* @__PURE__ */ f("div", { className: _("panel-resizer"), style: r, onMouseDown: l }),
    /* @__PURE__ */ f("div", { className: _("panel-resizer-guide"), style: i })
  ] });
}
function ma(e, t) {
  return t ? Math.min(t, e) : e;
}
function Lh({
  initialHeight: e,
  initialWidth: t,
  overflowX: n,
  overflowY: r,
  maxExpandableWidth: o,
  maxExpandableHeight: i,
  minHeight: s,
  maxHeight: c,
  minWidth: u,
  maxWidth: l
}) {
  const a = {};
  return t && (a.width = ma(t, o), a.height = "100%"), e && (a.width = "100%", a.height = ma(e, i)), n && (a.overflowX = "auto"), r && (a.overflowY = "auto"), ae(R({}, a), { minHeight: s, maxHeight: c, minWidth: u, maxWidth: l });
}
const Vt = Xc(function({
  name: t,
  initialWidth: n = Zt,
  initialHeight: r = Zt,
  overflowX: o,
  overflowY: i,
  maxExpandableWidth: s,
  maxExpandableHeight: c,
  minHeight: u,
  maxHeight: l,
  minWidth: a,
  maxWidth: d,
  resizerWidth: p = Ko,
  resizerHeight: h = Ko,
  resizable: m,
  children: w
}, y) {
  const { updateDayGridRowHeight: v } = _e("weekViewLayout"), { height: E } = G(
    J((N) => {
      var M;
      return (M = N.weekViewLayout.dayGridRows[t]) != null ? M : {};
    }, [t])
  ), T = E != null ? E : r;
  ht(() => {
    v({ rowName: t, height: r });
  }, [r, t, v]);
  const k = Lh({
    initialWidth: n,
    initialHeight: T,
    overflowX: o,
    overflowY: i,
    maxExpandableWidth: s,
    maxExpandableHeight: c,
    minHeight: u,
    maxHeight: l,
    minWidth: a,
    maxWidth: d
  }), D = U(() => z(m) || vi(m) ? !!m : m.includes(t), [m, t]);
  return /* @__PURE__ */ f(Me, { children: [
    /* @__PURE__ */ f("div", { className: _("panel", t), style: k, ref: y, children: w }),
    D ? /* @__PURE__ */ f(
      Ph,
      {
        name: t,
        width: p,
        height: h
      }
    ) : null
  ] });
}), ul = "timegrid", Se = (e) => `${ul}-${e}`, Hh = {
  second: "HH:mm:ss",
  minute: "HH:mm",
  hour: "HH:mm",
  date: "HH:mm",
  month: "MM.DD",
  year: "YYYY.MM.DD"
}, Ge = {
  time: _("event-time"),
  content: _("event-time-content"),
  travelTime: _("travel-time"),
  resizeHandleX: _("resize-handler-x"),
  moveEvent: _("dragging--move-event"),
  resizeEvent: _("dragging--resize-vertical-event")
};
function $h(e) {
  const { percent: t, px: n } = Vo(`${e}`);
  return e > 0 || t > 0 || n > 0 ? vr : 0;
}
function Bh(e, t) {
  return be(e) ? e : e >= 0 ? `calc(${q(e)} - ${t}px)` : "";
}
function Fh({
  uiModel: e,
  isDraggingTarget: t,
  hasNextStartTime: n,
  calendarColor: r,
  minHeight: o
}) {
  const {
    top: i,
    left: s,
    height: c,
    width: u,
    duplicateLeft: l,
    duplicateWidth: a,
    goingDurationHeight: d,
    modelDurationHeight: p,
    comingDurationHeight: h,
    croppedStart: m,
    croppedEnd: w
  } = e, y = "white", v = 2, E = 2, T = $h(s), { color: k, backgroundColor: D, borderColor: N, dragBackgroundColor: M } = cc(
    e,
    r
  ), H = {
    width: Bh(a || u, T),
    height: `calc(${q(Math.max(c, o))} - ${E}px)`,
    top: q(i),
    left: l || q(s),
    borderRadius: v,
    borderLeft: `3px solid ${N}`,
    marginLeft: T,
    color: k,
    backgroundColor: t ? M : D,
    opacity: t ? 0.5 : 1,
    zIndex: n ? 1 : 0
  }, $ = {
    height: q(d),
    borderBottom: `1px dashed ${y}`
  }, Y = {
    height: q(p)
  }, B = {
    height: q(h),
    borderTop: `1px dashed ${y}`
  };
  return m && (H.borderTopLeftRadius = 0, H.borderTopRightRadius = 0), w && (H.borderBottomLeftRadius = 0, H.borderBottomRightRadius = 0), {
    containerStyle: H,
    goingDurationStyle: $,
    modelDurationStyle: Y,
    comingDurationStyle: B
  };
}
function Gh({
  uiModel: e,
  isReadOnlyCalendar: t,
  isDraggingTarget: n,
  hasNextStartTime: r
}) {
  const { model: o } = e;
  return !t && !o.isReadOnly && !n && !r;
}
function Fi({
  uiModel: e,
  nextStartTime: t,
  isResizingGuide: n = !1,
  minHeight: r = 0
}) {
  const {
    useDetailPopup: o,
    isReadOnly: i,
    week: s
  } = G(We), c = Pi(e.model), { collapseDuplicateEvents: u } = s, l = At(), { showDetailPopup: a } = _e("popup"), { setDraggingEventUIModel: d } = _e("dnd"), { setSelectedDuplicateEventCid: p } = _e("weekViewLayout"), h = Ce(), m = ee(null), [w, y] = se(!1), { model: v, goingDurationHeight: E, modelDurationHeight: T, comingDurationHeight: k, croppedEnd: D } = e, { id: N, calendarId: M, customStyle: H } = v, $ = x(t), { containerStyle: Y, goingDurationStyle: B, modelDurationStyle: X, comingDurationStyle: Q } = Fh(
    { uiModel: e, isDraggingTarget: w, hasNextStartTime: $, calendarColor: c, minHeight: r }
  ), S = $ || n;
  vt(Mt, ({ draggingEventUIModel: ce, draggingState: Be }) => {
    Be === ze.DRAGGING && (ce == null ? void 0 : ce.cid()) === e.cid() && !$ && !n ? y(!0) : y(!1);
  }), re(() => {
    n || h.fire("afterRenderEvent", e.model.toEventObject());
  }, []);
  const b = (ce) => {
    d(e), l == null || l.classList.add(ce);
  }, W = (ce) => {
    y(!1), l == null || l.classList.remove(ce);
  }, te = Qt(Rn.moveEvent("timeGrid", `${e.cid()}`), {
    onDragStart: () => {
      Re && b(Ge.moveEvent);
    },
    onMouseUp: (ce, { draggingState: Be }) => {
      W(Ge.moveEvent);
      const xe = Be <= ze.INIT;
      if (xe && u) {
        const at = e.duplicateEvents.length > 0 ? e.cid() : Rr;
        p(at);
      }
      xe && o && m.current && a(
        {
          event: e.model,
          eventRect: m.current.getBoundingClientRect()
        },
        !1
      ), xe && h.fire("clickEvent", { event: e.model.toEventObject(), nativeEvent: ce });
    },
    onPressESCKey: () => W(Ge.moveEvent)
  }), he = (ce) => {
    ce.stopPropagation(), te(ce);
  }, j = Qt(
    Rn.resizeEvent("timeGrid", `${e.cid()}`),
    {
      onDragStart: () => b(Ge.resizeEvent),
      onMouseUp: () => W(Ge.resizeEvent),
      onPressESCKey: () => W(Ge.resizeEvent)
    }
  ), le = (ce) => {
    ce.stopPropagation(), j(ce);
  }, Re = Gh({
    uiModel: e,
    isReadOnlyCalendar: i,
    isDraggingTarget: w,
    hasNextStartTime: $
  }), wt = Re && !D;
  return /* @__PURE__ */ f(
    "div",
    {
      "data-testid": `${S ? "guide-" : ""}time-event-${v.title}-${e.cid()}`,
      "data-calendar-id": M,
      "data-event-id": N,
      className: Ge.time,
      style: R(R({}, Y), H),
      onMouseDown: he,
      ref: m,
      children: [
        E ? /* @__PURE__ */ f("div", { className: Ge.travelTime, style: B, children: /* @__PURE__ */ f(ne, { template: "goingDuration", param: v }) }) : null,
        T ? /* @__PURE__ */ f("div", { className: Ge.content, style: X, children: /* @__PURE__ */ f(
          ne,
          {
            template: "time",
            param: ae(R({}, v.toEventObject()), {
              start: $ ? t : v.start
            })
          }
        ) }) : null,
        k ? /* @__PURE__ */ f("div", { className: Ge.travelTime, style: Q, children: /* @__PURE__ */ f(ne, { template: "comingDuration", param: v }) }) : null,
        wt ? /* @__PURE__ */ f("div", { className: Ge.resizeHandleX, onMouseDown: le }) : null
      ]
    }
  );
}
function Uh({ top: e, height: t, text: n }) {
  const { backgroundColor: r, border: o } = ie(
    J((c) => c.common.gridSelection, [])
  ), i = ie(J((c) => c.week.gridSelection.color, [])), s = {
    top: q(e),
    height: q(t),
    backgroundColor: r,
    border: o
  };
  return /* @__PURE__ */ f(
    "div",
    {
      className: _("time", "grid-selection"),
      style: s,
      "data-testid": `time-grid-selection-${e}-${t}`,
      children: n.length > 0 ? /* @__PURE__ */ f("span", { className: _("grid-selection-label"), style: { color: i }, children: n }) : null
    }
  );
}
function zh({ columnIndex: e, timeGridRows: t }) {
  const n = G(
    J(
      (o) => Jo.calculateSelection(
        o.gridSelection.timeGrid,
        e,
        t.length - 1
      ),
      [e, t]
    )
  ), r = U(() => {
    if (!n)
      return null;
    const { startRowIndex: o, endRowIndex: i, isStartingColumn: s, isSelectingMultipleColumns: c } = n, { top: u, startTime: l } = t[o], {
      top: a,
      height: d,
      endTime: p
    } = t[i], h = a + d - u;
    let m = `${l} - ${p}`;
    return c && (m = s ? l : ""), {
      top: u,
      height: h,
      text: m
    };
  }, [n, t]);
  return z(r) ? null : /* @__PURE__ */ f(Uh, R({}, r));
}
function Wh({
  gridPositionFinder: e,
  totalUIModels: t,
  columnIndex: n,
  timeGridData: r
}) {
  const o = Ce(), {
    isDraggingEnd: i,
    isDraggingCanceled: s,
    draggingEvent: c,
    clearDraggingEvent: u
  } = dn("timeGrid", "resize"), [l, a] = un(e), [d, p] = se(null), h = J(() => {
    p(null), u(), a();
  }, [a, u]), m = U(() => {
    if (z(c))
      return null;
    const { columns: v, rows: E } = r, T = t.map(
      (b) => b.filter(
        (W) => W.cid() === c.cid()
      )
    ), k = (b, W) => (te) => {
      const he = je(v[W].date, te.startTime), j = je(
        r.columns[W].date,
        te.endTime
      );
      return he <= b && b < j;
    }, D = T.findIndex((b) => b.length > 0), N = T[D][0], { goingDuration: M = 0 } = N.model, H = Ie(N.getStarts(), -M), $ = Math.max(
      E.findIndex(k(H, D)),
      0
    ), Y = _i(
      T,
      (b) => b.length > 0
    ), B = T[Y][0], { comingDuration: X = 0 } = B.model, Q = Ie(B.getStarts(), X);
    let S = E.findIndex(k(Q, Y));
    return S = S >= 0 ? S : E.length - 1, {
      eventStartDateColumnIndex: D,
      eventStartDateRowIndex: $,
      eventEndDateColumnIndex: Y,
      eventEndDateRowIndex: S,
      resizeTargetUIModelColumns: T
    };
  }, [c, r, t]), w = x(m) && x(c) && x(l), y = U(
    () => m ? r.rows[0].height : 0,
    [m, r.rows]
  );
  return re(() => {
    if (w) {
      const { eventStartDateRowIndex: v, eventStartDateColumnIndex: E, eventEndDateColumnIndex: T } = m;
      if (n === T && E === T) {
        const k = c.clone(), { height: D, goingDurationHeight: N, comingDurationHeight: M } = k, H = Math.max(
          y + N * D / 100 + M * D / 100,
          r.rows[l.rowIndex].top - r.rows[v].top + y
        ), $ = N * D / H, Y = M * D / H;
        k.setUIProps({
          height: H,
          goingDurationHeight: $,
          comingDurationHeight: Y,
          modelDurationHeight: 100 - ($ + Y)
        }), p(k);
      }
    }
  }, [
    m,
    w,
    n,
    l,
    c,
    r.rows,
    y
  ]), re(() => {
    if (w) {
      const { resizeTargetUIModelColumns: v, eventStartDateColumnIndex: E, eventEndDateColumnIndex: T } = m;
      if ((n === E || n === T) && E !== T) {
        let k;
        n === E ? k = v[n][0].clone() : (k = c.clone(), k.setUIProps({
          height: r.rows[l.rowIndex].top + y
        })), p(k);
      }
    }
  }, [
    m,
    w,
    n,
    l,
    c,
    r.rows,
    y
  ]), ln(() => {
    if (!s && x(m) && x(l) && x(c) && m.eventEndDateColumnIndex === n) {
      const { comingDuration: E = 0 } = c.model, T = Ie(
        je(
          r.columns[n].date,
          r.rows[l.rowIndex].endTime
        ),
        -E
      ), k = Ie(c.getStarts(), 30);
      o.fire("beforeUpdateEvent", {
        event: c.model.toEventObject(),
        changes: {
          end: wi(k, T)
        }
      });
    }
    h();
  }, i), d;
}
function Yh({
  gridPositionFinder: e,
  totalUIModels: t,
  columnIndex: n,
  timeGridData: r
}) {
  const o = Wh({
    gridPositionFinder: e,
    totalUIModels: t,
    columnIndex: n,
    timeGridData: r
  });
  return z(o) ? null : /* @__PURE__ */ f(Fi, { uiModel: o, isResizingGuide: !0 });
}
const dl = {
  column: _("column"),
  backgrounds: _("background-events"),
  events: _("events")
};
function Vh({
  eventUIModels: e,
  minEventHeight: t
}) {
  const n = { marginRight: 8 };
  return /* @__PURE__ */ f("div", { className: dl.events, style: n, children: e.map((r) => /* @__PURE__ */ f(
    Fi,
    {
      uiModel: r,
      minHeight: t
    },
    `${r.valueOf()}-${r.cid()}`
  )) });
}
function jh(e) {
  return {
    defaultBackgroundColor: e.week.dayGrid.backgroundColor,
    todayBackgroundColor: e.week.today.backgroundColor,
    weekendBackgroundColor: e.week.weekend.backgroundColor
  };
}
function qh({
  today: e,
  columnDate: t,
  defaultBackgroundColor: n,
  todayBackgroundColor: r,
  weekendBackgroundColor: o
}) {
  const i = kt(e, t), s = $e(t.getDay());
  return i ? r : s ? o : n;
}
const Xh = cn(function({
  columnDate: t,
  columnWidth: n,
  columnIndex: r,
  totalUIModels: o,
  gridPositionFinder: i,
  timeGridData: s,
  isLastColumn: c
}) {
  const { rows: u } = s, l = ie(J((v) => v.week.timeGrid.borderRight, [])), a = ie(jh), [, d] = $r(), p = d(), h = qh(R({ today: p, columnDate: t }, a)), m = {
    width: n,
    backgroundColor: h,
    borderRight: c ? "none" : l
  }, w = o[r], y = u[0].height;
  return /* @__PURE__ */ f(
    "div",
    {
      className: dl.column,
      style: m,
      "data-testid": `timegrid-column-${t.getDay()}`,
      children: [
        /* @__PURE__ */ f(Vh, { eventUIModels: w, minEventHeight: y }),
        /* @__PURE__ */ f(
          Yh,
          {
            gridPositionFinder: i,
            totalUIModels: o,
            columnIndex: r,
            timeGridData: s
          }
        ),
        /* @__PURE__ */ f(zh, { columnIndex: r, timeGridRows: u })
      ]
    }
  );
});
function Kh(e) {
  return {
    halfHourLineBorder: e.week.timeGridHalfHourLine.borderBottom,
    hourLineBorder: e.week.timeGridHourLine.borderBottom
  };
}
const Zh = cn(function({
  timeGridRows: t
}) {
  const { halfHourLineBorder: n, hourLineBorder: r } = ie(Kh);
  return /* @__PURE__ */ f("div", { className: _("gridlines"), children: t.map((o, i) => {
    const s = i % 2 === 0;
    return /* @__PURE__ */ f(
      "div",
      {
        className: _("gridline-half"),
        style: {
          top: q(o.top),
          height: q(o.height),
          borderBottom: s ? n : r
        },
        "data-testid": `gridline-${o.startTime}-${o.endTime}`
      },
      `gridline-${o.startTime}-${o.endTime}`
    );
  }) });
}), Jh = 30;
function ga(e, t) {
  const n = e.getHours() - t, r = e.getMinutes();
  return n * 2 + Math.floor(r / Jh);
}
function Qh({
  draggingEvent: e,
  columnDiff: t,
  rowDiff: n,
  timeGridDataRows: r,
  currentDate: o
}) {
  const i = r[0].height, s = i * r.length, c = n * lc + t * ot, u = Number(r[0].startTime.split(":")[0]), { goingDuration: l = 0, comingDuration: a = 0 } = e.model, d = Ie(e.getStarts(), -l), p = Ie(e.getEnds(), a), h = yr(d, c), m = yr(p, c), w = Math.max(ga(h, u), 0), y = Math.min(ga(m, u), r.length - 1), v = h.getFullYear() < o.getFullYear() || h.getMonth() < o.getMonth() || h.getDate() < o.getDate(), E = m.getFullYear() > o.getFullYear() || m.getMonth() > o.getMonth() || m.getDate() > o.getDate(), T = y - (v ? 0 : w), k = v ? 0 : r[w].top, D = E ? s : Math.max(T, 1) * i;
  return { top: k, height: D };
}
const em = (e) => e.dnd.initX, tm = (e) => e.dnd.initY;
function nm({
  gridPositionFinder: e,
  timeGridData: t
}) {
  const n = G(em), r = G(tm), o = Ce(), { isDraggingEnd: i, isDraggingCanceled: s, draggingEvent: c, clearDraggingEvent: u } = dn(
    "timeGrid",
    "move"
  ), [l, a] = un(e), d = ee(null);
  re(() => {
    x(n) && x(r) && (d.current = e({
      clientX: n,
      clientY: r
    }));
  }, [e, n, r]);
  const p = U(() => z(d.current) || z(l) ? null : {
    columnDiff: l.columnIndex - d.current.columnIndex,
    rowDiff: l.rowIndex - d.current.rowIndex
  }, [l]), h = U(() => z(c) ? null : c.getStarts(), [c]), m = J(() => {
    a(), u(), d.current = null;
  }, [a, u]), w = U(() => z(p) || z(h) ? null : yr(
    h,
    p.rowDiff * lc + p.columnDiff * ot
  ), [p, h]), y = U(() => {
    if (z(c) || z(l) || z(p))
      return null;
    const v = c.clone(), { top: E, height: T } = Qh({
      draggingEvent: v,
      columnDiff: p.columnDiff,
      rowDiff: p.rowDiff,
      timeGridDataRows: t.rows,
      currentDate: t.columns[l.columnIndex].date
    });
    return v.setUIProps({
      left: t.columns[l.columnIndex].left,
      width: t.columns[l.columnIndex].width,
      top: E,
      height: T
    }), v;
  }, [l, c, p, t.columns, t.rows]);
  return ln(() => {
    if (!s && x(c) && x(l) && x(p) && x(w) && (p.rowDiff !== 0 || p.columnDiff !== 0)) {
      const E = c.duration(), T = yr(w, E);
      o.fire("beforeUpdateEvent", {
        event: c.model.toEventObject(),
        changes: {
          start: w,
          end: T
        }
      });
    }
    m();
  }, i), {
    movingEvent: y,
    nextStartTime: w
  };
}
function rm({
  gridPositionFinder: e,
  timeGridData: t
}) {
  const { movingEvent: n, nextStartTime: r } = nm({
    gridPositionFinder: e,
    timeGridData: t
  });
  return z(n) ? null : /* @__PURE__ */ f(Fi, { uiModel: n, nextStartTime: r });
}
const fl = {
  NOW_INDICATOR: "timegrid-now-indicator",
  NOW_INDICATOR_LABEL: "timegrid-now-indicator-label"
}, wn = {
  line: _(Se("now-indicator")),
  left: _(Se("now-indicator-left")),
  marker: _(Se("now-indicator-marker")),
  today: _(Se("now-indicator-today")),
  right: _(Se("now-indicator-right"))
};
function om(e) {
  return {
    pastBorder: e.week.nowIndicatorPast.border,
    todayBorder: e.week.nowIndicatorToday.border,
    futureBorder: e.week.nowIndicatorFuture.border,
    bulletBackgroundColor: e.week.nowIndicatorBullet.backgroundColor
  };
}
function im({ top: e, columnWidth: t, columnCount: n, columnIndex: r }) {
  const { pastBorder: o, todayBorder: i, futureBorder: s, bulletBackgroundColor: c } = ie(om), u = At(), l = Ce(), a = ee(null), d = {
    left: q(t * r),
    width: q(t * r)
  }, p = {
    left: q(t * (r + 1))
  };
  return re(() => {
    const h = (m) => {
      var y;
      const w = (y = u == null ? void 0 : u.querySelector(`.${_("panel")}.${_("time")}`)) != null ? y : null;
      if (w && a.current) {
        const { offsetHeight: v } = w, { offsetTop: E } = a.current, T = E - v / 2;
        w.scrollTo ? w.scrollTo({ top: T, behavior: m }) : w.scrollTop = T;
      }
    };
    return l.on("scrollToNow", h), () => l.off("scrollToNow", h);
  }, [l, u]), re(() => {
    l.fire("scrollToNow", "smooth");
  }, [l]), /* @__PURE__ */ f(
    "div",
    {
      ref: a,
      className: wn.line,
      style: { top: q(e) },
      "data-testid": fl.NOW_INDICATOR,
      children: [
        /* @__PURE__ */ f("div", { className: wn.left, style: { width: d.width, borderTop: o } }),
        /* @__PURE__ */ f(
          "div",
          {
            className: wn.marker,
            style: { left: d.left, backgroundColor: c }
          }
        ),
        /* @__PURE__ */ f(
          "div",
          {
            className: wn.today,
            style: {
              left: d.left,
              width: q(t),
              borderTop: i
            }
          }
        ),
        /* @__PURE__ */ f(
          "div",
          {
            className: wn.right,
            style: {
              left: p.left,
              borderTop: s
            }
          }
        )
      ]
    }
  );
}
const va = {
  now: Se("current-time"),
  dayDifference: Se("day-difference")
};
function sm({ unit: e, top: t, now: n, zonedNow: r }) {
  const o = ie(J((c) => c.week.nowIndicatorLabel.color, [])), i = U(() => Ti(r, n), [r, n]), s = {
    unit: e,
    time: r,
    format: Hh[e]
  };
  return /* @__PURE__ */ f(
    "div",
    {
      className: _(va.now),
      style: { top: q(t), color: o },
      "data-testid": fl.NOW_INDICATOR_LABEL,
      children: [
        i !== 0 && /* @__PURE__ */ f("span", { className: _(va.dayDifference), children: `[${i > 0 ? "+" : "-"}${Math.abs(i)}]` }),
        /* @__PURE__ */ f(ne, { template: "timegridNowIndicatorLabel", param: s, as: "span" })
      ]
    }
  );
}
const am = (e) => {
  var t;
  return (t = e.options.month.visibleEventCount) != null ? t : 6;
}, Gi = (e) => e.options.week.showNowIndicator, cm = (e) => {
  var t;
  return (t = e.options.week.showTimezoneCollapseButton) != null ? t : !1;
}, pl = (e) => {
  var t;
  return (t = e.options.week.timezonesCollapsed) != null ? t : !1;
}, zt = {
  timeColumn: Se("time-column"),
  hourRows: Se("hour-rows"),
  time: Se("time"),
  first: Se("time-first"),
  last: Se("time-last"),
  hidden: Se("time-hidden")
};
function lm(e) {
  return {
    primaryTimezoneBackgroundColor: e.week.timeGridLeft.backgroundColor,
    subTimezoneBackgroundColor: e.week.timeGridLeftAdditionalTimezone.backgroundColor
  };
}
function um(e) {
  return {
    pastTimeColor: e.week.pastTime.color,
    futureTimeColor: e.week.futureTime.color
  };
}
function _a({ rowsInfo: e, isPrimary: t, borderRight: n, width: r, nowIndicatorState: o }) {
  var p;
  const i = G(Gi), { primaryTimezoneBackgroundColor: s, subTimezoneBackgroundColor: c } = ie(lm), { pastTimeColor: u, futureTimeColor: l } = ie(um), a = x(o) ? Ie(o.now, (p = e[0].diffFromPrimaryTimezone) != null ? p : 0) : null, d = t ? s : c;
  return /* @__PURE__ */ f(
    "div",
    {
      role: "rowgroup",
      className: _(zt.hourRows),
      style: { width: q(r), borderRight: n, backgroundColor: d },
      children: [
        e.map(({ date: h, top: m, className: w }) => {
          const v = x(a) && h < a ? u : l;
          return /* @__PURE__ */ f(
            "div",
            {
              className: w,
              style: {
                top: q(m),
                color: v
              },
              role: "row",
              children: /* @__PURE__ */ f(
                ne,
                {
                  template: `timegridDisplay${t ? "Primary" : ""}Time`,
                  param: { time: h },
                  as: "span"
                }
              )
            },
            h.getTime()
          );
        }),
        i && x(o) && x(a) && /* @__PURE__ */ f(
          sm,
          {
            unit: "hour",
            top: o.top,
            now: o.now,
            zonedNow: a
          }
        )
      ]
    }
  );
}
const dm = cn(function({ timeGridRows: t, nowIndicatorState: n }) {
  const r = G(Gi), o = G(Nc), i = G(pl), s = Hr(), { width: c, borderRight: u } = ie(bi), l = U(
    () => t.filter((y, v) => v % 2 === 0 || v === t.length - 1),
    [t]
  ), a = J(
    (y, v, E) => {
      const T = ({ top: H, height: $ }) => {
        if (!r || z(n))
          return !1;
        const Y = n.top;
        return H - $ <= Y && Y <= H + $;
      }, k = v === 0, D = v === l.length - 1, N = _(zt.time, {
        [zt.first]: k,
        [zt.last]: D,
        [zt.hidden]: T(y)
      });
      let M = je(new O(), D ? y.endTime : y.startTime);
      return x(E) && (M = Ie(M, E)), {
        date: M,
        top: y.top,
        className: N,
        diffFromPrimaryTimezone: E
      };
    },
    [l, n, r]
  ), [d, ...p] = o, h = p.length > 0 ? 100 / (p.length + 1) : 100, m = l.map(
    (y, v) => a(y, v)
  ), w = U(() => p.length === 0 ? [] : p.reverse().map((y) => {
    const { timezoneName: v } = y, E = s(d.timezoneName).getTimezoneOffset(), k = s(v).getTimezoneOffset() - E;
    return l.map(
      (D, N) => a(D, N, k)
    );
  }), [a, p, d, l, s]);
  return /* @__PURE__ */ f(
    "div",
    {
      className: _(zt.timeColumn),
      style: { width: c },
      "data-testid": "timegrid-time-column",
      children: [
        !i && w.map((y) => /* @__PURE__ */ f(
          _a,
          {
            rowsInfo: y,
            isPrimary: !1,
            borderRight: u,
            width: h,
            nowIndicatorState: n
          },
          y[0].diffFromPrimaryTimezone
        )),
        /* @__PURE__ */ f(
          _a,
          {
            rowsInfo: m,
            isPrimary: !0,
            borderRight: u,
            width: i ? 100 : h,
            nowIndicatorState: n
          }
        )
      ]
    }
  );
});
function ri(e, t, n) {
  const r = t.getTime(), o = n.getTime(), i = Zo(e.getTime(), [r], [o]) - r, s = o - r, c = $c(s, 100, i);
  return Zo(c, [0], [100]);
}
function oi(e, t, n, r) {
  const o = ri(e, n, r), s = ri(t, n, r) - o;
  return {
    top: o,
    height: s
  };
}
const fm = 1;
function hl(e, t) {
  return (n) => {
    const { goingDuration: r = 0, comingDuration: o = 0 } = n.model, i = Ie(n.getStarts(), -r);
    return !(Ie(n.getEnds(), o) <= e || i >= t);
  };
}
function pm(e, t) {
  const { renderStart: n, renderEnd: r, modelStart: o, modelEnd: i } = t, { goingDuration: s = 0, comingDuration: c = 0 } = e.model;
  let u = 100;
  if (s > 0) {
    const { height: l } = oi(
      n,
      o,
      n,
      r
    );
    e.goingDurationHeight = l, u -= l;
  }
  if (c > 0) {
    const { height: l } = oi(
      i,
      r,
      n,
      r
    );
    e.comingDurationHeight = l, u -= l;
  }
  e.modelDurationHeight = u;
}
function hm(e, t) {
  const { goingStart: n, comingEnd: r, startColumnTime: o, endColumnTime: i } = t;
  n < o && (e.croppedStart = !0), r > i && (e.croppedEnd = !0);
}
function mm(e, t) {
  const { duplicateEvents: n, duplicateEventIndex: r } = e, o = n[r - 1];
  let i = t;
  if (o) {
    const { percent: s, px: c } = Vo(`${o.duplicateLeft}`), { percent: u, px: l } = Vo(`${o.duplicateWidth}`), a = s + u, d = c + l + vr;
    a !== 0 ? i = `calc(${q(a)} ${d > 0 ? "+" : "-"} ${_r(Math.abs(d))})` : i = _r(d);
  } else
    i = q(i);
  return i;
}
function gm(e, t) {
  const { collapse: n } = e;
  return n ? `${Bs}px` : `calc(${q(t)} - ${_r(
    (Bs + vr) * (e.duplicateEvents.length - 1) + vr
  )})`;
}
function vm(e, t) {
  const { startColumnTime: n, endColumnTime: r, baseWidth: o, columnIndex: i, renderStart: s, renderEnd: c } = t, { duplicateEvents: u } = e, { top: l, height: a } = oi(
    s,
    c,
    n,
    r
  ), d = {
    top: l,
    left: o * i,
    width: o,
    height: Math.max(fm, a),
    duplicateLeft: "",
    duplicateWidth: ""
  };
  u.length > 0 && (d.duplicateLeft = mm(e, d.left), d.duplicateWidth = gm(e, d.width)), e.setUIProps(d);
}
function _m(e, t, n, r, o) {
  const { goingDuration: i = 0, comingDuration: s = 0 } = e.model, c = e.getStarts(), u = e.getEnds(), l = Ie(c, -i), a = Ie(u, s), d = wi(l, r), p = uc(a, o);
  return {
    baseWidth: n,
    columnIndex: t,
    modelStart: c,
    modelEnd: u,
    renderStart: d,
    renderEnd: p,
    goingStart: l,
    comingEnd: a,
    startColumnTime: r,
    endColumnTime: o,
    duplicateEvents: e.duplicateEvents
  };
}
function ml({
  uiModel: e,
  columnIndex: t,
  baseWidth: n,
  startColumnTime: r,
  endColumnTime: o,
  isDuplicateEvent: i = !1
}) {
  if (!i && e.duplicateEvents.length > 0) {
    e.duplicateEvents.forEach((c) => {
      ml({
        uiModel: c,
        columnIndex: t,
        baseWidth: n,
        startColumnTime: r,
        endColumnTime: o,
        isDuplicateEvent: !0
      });
    });
    return;
  }
  const s = _m(
    e,
    t,
    n,
    r,
    o
  );
  vm(e, s), pm(e, s), hm(e, s);
}
function ym(e, t, n) {
  const { getDuplicateEvents: r, getMainEvent: o } = t, i = e.map((s) => s.model.toEventObject());
  return e.forEach((s) => {
    if (s.collapse || s.duplicateEvents.length > 0)
      return;
    const c = r(s.model.toEventObject(), i);
    if (c.length <= 1)
      return;
    const u = o(c), l = c.map(
      (h) => e.find((m) => m.cid() === h.__cid)
    ), a = !!(n > Rr && c.find((h) => h.__cid === n)), d = c.reduce((h, { start: m, goingDuration: w }) => {
      const y = Ie(m, -w);
      return uc(h, y);
    }, c[0].start), p = c.reduce((h, { end: m, comingDuration: w }) => {
      const y = Ie(m, w);
      return wi(h, y);
    }, c[0].end);
    l.forEach((h, m) => {
      const w = h.cid() === u.__cid, y = !(a && h.cid() === n || !a && w);
      h.setUIProps({
        duplicateEvents: l,
        duplicateEventIndex: m,
        collapse: y,
        isMain: w,
        duplicateStarts: d,
        duplicateEnds: p
      });
    });
  }), e;
}
function wm(e, t, n, r, o) {
  const i = e.filter(Id).filter(hl(t, n)).sort(Ct.compare.event.asc);
  o && ym(i, o, r);
  const s = i.filter((d) => !d.collapse), c = Jt(...s), u = !0, l = Br(s, u);
  return Fr(c, l, u).forEach((d) => {
    const p = Math.max(...d.map((m) => m.length)), h = Math.round(100 / p);
    d.forEach((m) => {
      m.forEach((w, y) => {
        ml({ uiModel: w, columnIndex: y, baseWidth: h, startColumnTime: t, endColumnTime: n });
      });
    });
  }), i;
}
function Em(e, t) {
  const n = ee(e);
  re(() => {
    n.current = e;
  }, [e]), re(() => {
    const r = () => n.current(), o = t != null ? t : -1;
    if (o > 0) {
      const i = setInterval(r, o);
      return () => clearInterval(i);
    }
  }, [t]);
}
function Dm() {
  const e = ee(!0);
  return re(() => () => {
    e.current = !1;
  }, []), J(() => e.current, []);
}
const ya = {
  timegrid: _(ul),
  scrollArea: _(Se("scroll-area"))
};
function gl({ timeGridData: e, events: t }) {
  const {
    isReadOnly: n,
    week: { narrowWeekend: r, startDayOfWeek: o, collapseDuplicateEvents: i }
  } = G(We), s = G(Gi), c = G(
    (M) => M.weekViewLayout.selectedDuplicateEventCid
  ), [, u] = $r(), l = Dm(), { width: a } = ie(bi), [d, p] = se(null), { columns: h, rows: m } = e, w = h.length - 1, y = U(
    () => h.map(
      ({ date: M }) => t.filter(hl(pe(M), Ae(M))).map((H) => H.clone())
    ).map(
      (M, H) => wm(
        M,
        je(h[H].date, jo(m).startTime),
        je(h[H].date, rt(m).endTime),
        c,
        i
      )
    ),
    [h, m, t, c, i]
  ), v = U(() => {
    const M = u(), H = h.findIndex((B) => kt(B.date, M));
    if (H < 0)
      return null;
    const $ = je(
      h[H].date,
      e.rows[0].startTime
    ), Y = je(
      h[H].date,
      rt(e.rows).endTime
    );
    return {
      startTime: $,
      endTime: Y,
      currentDateIndex: H
    };
  }, [h, u, e.rows]), [E, T] = He(), k = U(
    () => Ai({
      rowsCount: m.length,
      columnsCount: h.length,
      container: E,
      narrowWeekend: r,
      startDayOfWeek: o
    }),
    [h.length, E, r, m.length, o]
  ), D = Hi({
    type: "timeGrid",
    gridPositionFinder: k,
    selectionSorter: Jo.sortSelection,
    dateGetter: Jo.getDateFromCollection,
    dateCollection: e
  }), N = J(() => {
    if (x(v)) {
      const { startTime: M, endTime: H } = v, $ = u();
      M <= $ && $ <= H && p({
        top: ri($, M, H),
        now: $
      });
    }
  }, [v, u]);
  return ht(() => {
    var M;
    l() && (((M = v == null ? void 0 : v.currentDateIndex) != null ? M : -1) >= 0 ? N() : p(null));
  }, [v, l, N]), Em(N, x(v) ? yi : null), /* @__PURE__ */ f("div", { className: ya.timegrid, children: /* @__PURE__ */ f("div", { className: ya.scrollArea, children: [
    /* @__PURE__ */ f(dm, { timeGridRows: m, nowIndicatorState: d }),
    /* @__PURE__ */ f(
      "div",
      {
        className: _("columns"),
        style: { left: a },
        ref: T,
        onMouseDown: Li(!n, D),
        children: [
          /* @__PURE__ */ f(Zh, { timeGridRows: m }),
          /* @__PURE__ */ f(rm, { gridPositionFinder: k, timeGridData: e }),
          h.map((M, H) => /* @__PURE__ */ f(
            Xh,
            {
              timeGridData: e,
              columnDate: M.date,
              columnWidth: q(M.width),
              columnIndex: H,
              totalUIModels: y,
              gridPositionFinder: k,
              isLastColumn: H === w
            },
            M.date.toString()
          )),
          s && x(v) && x(d) ? /* @__PURE__ */ f(
            im,
            {
              top: d.top,
              columnWidth: h[0].width,
              columnCount: h.length,
              columnIndex: v.currentDateIndex
            }
          ) : null
        ]
      }
    )
  ] }) });
}
function Sm({ isCollapsed: e }) {
  const t = Ce(), n = _("icon", {
    "ic-arrow-right": e,
    "ic-arrow-left": !e
  });
  return /* @__PURE__ */ f(
    "button",
    {
      className: _(Se("timezone-collapse-button")),
      "aria-expanded": !e,
      onClick: () => t.fire("clickTimezonesCollapseBtn", e),
      children: /* @__PURE__ */ f("span", { className: n, role: "img" })
    }
  );
}
function wa({ label: e, offset: t, tooltip: n, width: r = 100, left: o }) {
  return /* @__PURE__ */ f(
    "div",
    {
      title: n,
      className: _(Se("timezone-label")),
      style: {
        width: q(r),
        height: q(100),
        left: q(o)
      },
      role: "gridcell",
      children: /* @__PURE__ */ f(
        ne,
        {
          template: "timezoneDisplayLabel",
          param: { displayLabel: e, timezoneOffset: t },
          as: "span"
        }
      )
    }
  );
}
function Tm() {
  const e = G(cm), t = G(pl);
  return U(() => ({
    showTimezoneCollapseButton: e,
    timezonesCollapsed: t
  }), [e, t]);
}
function vl({ top: e }) {
  const t = G(Nc), { width: n } = ie(bi), r = Hr(), { showTimezoneCollapseButton: o, timezonesCollapsed: i } = Tm();
  if (t.length <= 1)
    return null;
  const s = t.map(({ displayLabel: p, timezoneName: h, tooltip: m }) => Ze(p) ? {
    label: null,
    offset: r(h).getTimezoneOffset(),
    tooltip: m != null ? m : h
  } : { label: p, offset: null, tooltip: m != null ? m : h }), [c, ...u] = s, l = u.reverse(), d = 100 / (i ? 1 : t.length);
  return /* @__PURE__ */ f(
    "div",
    {
      style: {
        top: e,
        width: n
      },
      role: "columnheader",
      className: _("timezone-labels-slot"),
      children: [
        !i && l.map((p, h) => {
          var m;
          return /* @__PURE__ */ f(
            wa,
            R({
              width: d,
              left: d * h
            }, p),
            `subTimezone-${(m = p.label) != null ? m : p.offset}`
          );
        }),
        o && /* @__PURE__ */ f(Sm, { isCollapsed: i }),
        /* @__PURE__ */ f(
          wa,
          R({
            width: d,
            left: d * l.length
          }, c)
        )
      ]
    }
  );
}
const bm = {
  MONTH: "month",
  WEEK: "week",
  DAY: "day"
}, Cm = ["milestone", "task"], km = ["allday", "time"];
function _l(e, t) {
  const n = [];
  return e === !0 ? n.push(...Cm) : Array.isArray(e) && n.push(...e), t === !0 ? n.push(...km) : Array.isArray(t) && n.push(...t), n;
}
function Nm(e) {
  const t = G(Lr), n = Hr();
  return U(() => {
    if (t === "Local")
      return e;
    const r = _n(new O()), {
      timedEvents: o = Jt(),
      totalEvents: i = Jt()
    } = e.groupBy(
      (s) => s.category === "time" ? "timedEvents" : "totalEvents"
    );
    return o.each((s) => {
      const c = dd(s);
      let u = n(t, c.start), l = n(t, c.end);
      r ? (_n(u) || (u = u.addHours(1)), _n(l) || (l = l.addHours(1))) : (_n(u) && (u = u.addHours(-1)), _n(l) && (l = l.addHours(-1))), c.start = u, c.end = l, i.add(c);
    }), i;
  }, [e, t, n]);
}
function Ui(e, ...t) {
  const n = U(
    () => e.events.filter(Xe.and(...t)),
    [e.events, t]
  ), r = Nm(n);
  return U(
    () => ae(R({}, e), {
      events: r
    }),
    [e, r]
  );
}
function Im(e) {
  return /^(event|gridSelection)\/timeGrid/.test(e != null ? e : "");
}
function yl(e, t) {
  vt(Mt, ({ y: n, draggingItemType: r, draggingState: o }) => {
    if (x(e) && Im(r) && o === ze.DRAGGING && x(n)) {
      const { offsetTop: i, offsetHeight: s, scrollHeight: c } = e, u = Math.floor(c / t), l = i + s;
      if (n < i + u) {
        const a = n - (i + u);
        e.scrollTop = Math.max(0, e.scrollTop + a);
      } else if (n > l - u) {
        const a = n - (l - u);
        e.scrollTop = Math.min(s, e.scrollTop + a);
      }
    }
  });
}
function Mm(e) {
  var t, n, r;
  return (r = (n = (t = e.weekViewLayout) == null ? void 0 : t.dayGridRows) == null ? void 0 : n.time) == null ? void 0 : r.height;
}
function wl(e) {
  const t = G(Mm), [n, r] = se(null);
  return ht(() => {
    x(t) && e && r(e.offsetTop);
  }, [t, e]), n;
}
function Am() {
  const e = G(Pr), t = G(We), { dayGridRows: n, lastPanelType: r } = G(bc), { renderDate: o } = G(an);
  return U(
    () => ({
      calendar: e,
      options: t,
      gridRowLayout: n,
      lastPanelType: r,
      renderDate: o
    }),
    [e, t, n, r, o]
  );
}
function El() {
  var B, X;
  const { calendar: e, options: t, gridRowLayout: n, lastPanelType: r, renderDate: o } = Am(), i = G(Lr), s = ie(J((Q) => Q.week.dayGridLeft.width, [])), [c, u] = He(), l = t.week, { narrowWeekend: a, startDayOfWeek: d, workweek: p, hourStart: h, hourEnd: m, eventView: w, taskView: y } = l, v = U(() => [o], [o]), E = _c(v, (X = (B = t.week) == null ? void 0 : B.dayNames) != null ? X : []), { rowStyleInfo: T, cellWidthMap: k } = Si(
    v.length,
    a,
    d,
    p
  ), D = Ui(e, t.eventFilter), N = U(() => {
    const Q = () => i === "Local" ? [pe(v[0]), Ae(v[0])] : [pe(Nt(v[0], -1)), Ae(Nt(v[0], 1))], [S, b] = Q();
    return Wc(v, D, {
      narrowWeekend: a,
      hourStart: h,
      hourEnd: m,
      weekStartDate: S,
      weekEndDate: b
    });
  }, [D, v, m, h, a, i]), M = U(
    () => jc(v, {
      hourStart: h,
      hourEnd: m,
      narrowWeekend: a
    }),
    [v, m, h, a]
  ), H = _l(y, w), $ = H.map((Q) => {
    var b, W;
    if (Q === "time")
      return null;
    const S = Q;
    return /* @__PURE__ */ f(Vt, { name: S, resizable: S !== r, children: S === "allday" ? /* @__PURE__ */ f(
      rl,
      {
        events: N[S],
        rowStyleInfo: T,
        gridColWidthMap: k,
        weekDates: v,
        height: (b = n[S]) == null ? void 0 : b.height,
        options: l
      }
    ) : /* @__PURE__ */ f(
      ol,
      {
        category: S,
        events: N[S],
        weekDates: v,
        height: (W = n[S]) == null ? void 0 : W.height,
        options: l,
        gridColWidthMap: k
      }
    ) }, S);
  });
  yl(c, M.rows.length);
  const Y = wl(c);
  return /* @__PURE__ */ f(Bi, { className: _("day-view"), autoAdjustPanels: !0, children: [
    /* @__PURE__ */ f(Vt, { name: "day-view-day-names", initialHeight: rc + oc, children: /* @__PURE__ */ f(
      Ci,
      {
        type: "week",
        dayNames: E,
        marginLeft: s,
        rowStyleInfo: T
      }
    ) }),
    $,
    H.includes("time") ? /* @__PURE__ */ f(Vt, { name: "time", autoSize: 1, ref: u, children: [
      /* @__PURE__ */ f(gl, { events: N.time, timeGridData: M }),
      /* @__PURE__ */ f(vl, { top: Y })
    ] }) : null
  ] });
}
function Rm({ rowIndex: e, weekDates: t, narrowWeekend: n }) {
  const r = G(
    J(
      (o) => o.gridSelection.accumulated.dayGridMonth.map(
        (i) => br.calculateSelection(i, e, t.length)
      ),
      [e, t]
    )
  );
  return /* @__PURE__ */ f("div", { className: _("accumulated-grid-selection"), children: r.map(
    (o) => o ? /* @__PURE__ */ f(
      Ri,
      {
        type: "accumulated",
        gridSelectionData: o,
        weekDates: t,
        narrowWeekend: n
      }
    ) : null
  ) });
}
function xm({ type: e, number: t, onClickButton: n, className: r }) {
  const { reset: o } = _e("dnd"), i = (u) => {
    u.stopPropagation();
  }, s = () => {
    o(), n();
  }, c = `monthGrid${e === An.header ? "Header" : "Footer"}Exceed`;
  return /* @__PURE__ */ f("button", { type: "button", onMouseDown: i, onClick: s, className: r, children: /* @__PURE__ */ f(ne, { template: c, param: t }) });
}
function Om({
  date: e,
  theme: t,
  renderDate: n,
  isToday: r
}) {
  const o = e.getDay(), s = n.getMonth() === e.getMonth(), {
    common: { holiday: c, saturday: u, today: l, dayName: a },
    month: { dayExceptThisMonth: d, holidayExceptThisMonth: p }
  } = t;
  return r ? l.color : Ei(o) ? s ? c.color : p.color : Di(o) ? s ? u.color : d.color : s ? a.color : d.color;
}
function Pm() {
  const e = Of(), t = Rc();
  return U(() => ({ common: e, month: t }), [e, t]);
}
function Ea({
  type: e = An.header,
  exceedCount: t = 0,
  date: n,
  onClickExceedCount: r
}) {
  const { renderDate: o } = G(an), [, i] = $r(), s = Pm(), c = s.month.gridCell[`${e}Height`], u = fe(n, "YYYYMMDD"), l = fe(i(), "YYYYMMDD"), a = u === l, d = {
    date: fe(n, "YYYY-MM-DD"),
    day: n.getDay(),
    hiddenEventCount: t,
    isOtherMonth: n.getMonth() !== o.getMonth(),
    isToday: u === l,
    month: n.getMonth(),
    ymd: u
  }, p = { color: Om({ date: n, theme: s, isToday: a, renderDate: o }) }, h = `monthGrid${xr(e)}`;
  return z(c) ? null : /* @__PURE__ */ f("div", { className: _(`grid-cell-${e}`), style: { height: c }, children: [
    /* @__PURE__ */ f("span", { className: _("grid-cell-date"), style: p, children: /* @__PURE__ */ f(ne, { template: h, param: d }) }),
    t ? /* @__PURE__ */ f(
      xm,
      {
        type: e,
        number: t,
        onClickButton: r,
        className: _("grid-cell-more-events")
      }
    ) : null
  ] });
}
function Lm({
  grid: e,
  offsetWidth: t,
  eventLength: n,
  layerSize: r
}) {
  const o = Ec(e).height + po * 2;
  let i = t + po * 2;
  const { width: s, height: c } = r, u = 10;
  i = Math.max(i, Au);
  let l = sr + Yo + po;
  const a = Kt + Ir;
  return n <= u ? l += a * n : l += a * u, s && (i = s), c && (l = c), (isNaN(l) || l < o) && (l = o), { width: i, height: l };
}
function Hm(e, t, n) {
  const {
    width: r,
    height: o,
    left: i,
    top: s
  } = t, { width: c, height: u } = e, l = i + r, a = s + o;
  let d = n.left + n.width / 2 - c / 2, { top: p } = n;
  const h = d < i, m = d + c > l, w = p < s, y = p + u > a;
  return h && (d = i), m && (d = l - c), w && (p = s), y && (p = a - u), { top: p + window.scrollY, left: d + window.scrollX };
}
function $m({
  layoutContainer: e,
  cell: t,
  popupSize: n
}) {
  const r = e.getBoundingClientRect(), o = t.getBoundingClientRect(), i = Hm(n, r, o);
  return R(R({}, n), i);
}
function Bm(e, t, n) {
  const { width: r, height: o } = ie(Sf), [i, s] = He(), [c, u] = se(null);
  return re(() => {
    if (n && t && i) {
      const l = Lm({
        grid: t,
        offsetWidth: i.offsetWidth,
        eventLength: e,
        layerSize: {
          width: r,
          height: o
        }
      }), a = $m({
        cell: i,
        layoutContainer: n,
        popupSize: l
      });
      u(a);
    }
  }, [n, i, e, t, r, o]), { popupPosition: c, containerRefCallback: s };
}
function Fm(e) {
  return e.month.weekend.backgroundColor;
}
function Gm({ date: e, events: t = [], style: n, parentContainer: r, contentAreaHeight: o }) {
  const i = At(), { showSeeMorePopup: s } = _e("popup"), c = ie(Fm), { popupPosition: u, containerRefCallback: l } = Bm(
    t.length,
    r,
    i
  ), a = J(() => {
    u && s({
      date: e,
      popupPosition: u,
      events: t
    });
  }, [e, t, u, s]), d = Gc(
    t,
    o,
    Kt + Ir
  );
  return /* @__PURE__ */ f(
    "div",
    {
      className: _("daygrid-cell"),
      style: ae(R({}, n), { backgroundColor: $e(e.getDay()) ? c : "inherit" }),
      ref: l,
      children: [
        /* @__PURE__ */ f(
          Ea,
          {
            type: An.header,
            exceedCount: d,
            date: e,
            onClickExceedCount: a
          }
        ),
        /* @__PURE__ */ f(
          Ea,
          {
            type: An.footer,
            exceedCount: d,
            date: e,
            onClickExceedCount: a
          }
        )
      ]
    }
  );
}
const Um = cn(function({
  week: t,
  rowInfo: n,
  gridDateEventModelMap: r = {},
  contentAreaHeight: o
}) {
  const [i, s] = He(), c = ie(J((u) => u.common.border, []));
  return /* @__PURE__ */ f("div", { className: _("weekday-grid"), style: { borderTop: c }, ref: s, children: t.map((u, l) => {
    const a = u.getDay(), { width: d, left: p } = n[l], h = fe(pe(u), "YYYYMMDD");
    return /* @__PURE__ */ f(
      Gm,
      {
        date: u,
        style: {
          width: q(d),
          left: q(p)
        },
        parentContainer: i,
        events: r[h],
        contentAreaHeight: o
      },
      `daygrid-cell-${a}`
    );
  }) });
});
function zm({ weekDates: e, narrowWeekend: t, rowIndex: n }) {
  const r = G(
    J(
      (o) => br.calculateSelection(
        o.gridSelection.dayGridMonth,
        n,
        e.length
      ),
      [n, e.length]
    )
  );
  return z(r) ? null : /* @__PURE__ */ f(
    Ri,
    {
      type: "month",
      gridSelectionData: r,
      weekDates: e,
      narrowWeekend: t
    }
  );
}
const Wm = cn(function({
  contentAreaHeight: t,
  eventHeight: n = Ke,
  events: r,
  name: o,
  className: i
}) {
  const { headerHeight: s } = ie(Ac), c = r.filter(Ii(t, n + Ir)).map((u) => /* @__PURE__ */ f(
    yt,
    {
      uiModel: u,
      eventHeight: n,
      headerHeight: s != null ? s : Mr
    },
    `${o}-DayEvent-${u.cid()}`
  ));
  return /* @__PURE__ */ f("div", { className: i, children: c });
});
function Ym({
  dateMatrix: e,
  rowInfo: t,
  gridPositionFinder: n,
  rowIndex: r
}) {
  const o = Ce(), {
    isDraggingEnd: i,
    isDraggingCanceled: s,
    draggingEvent: c,
    clearDraggingEvent: u
  } = dn("dayGrid", "move"), [l, a] = un(n), d = U(() => {
    var h, m;
    let p = null;
    return c && (l == null ? void 0 : l.rowIndex) === r && (p = c, p.left = t[(h = l == null ? void 0 : l.columnIndex) != null ? h : 0].left, p.width = t[(m = l == null ? void 0 : l.columnIndex) != null ? m : 0].width), p;
  }, [c, l == null ? void 0 : l.rowIndex, l == null ? void 0 : l.columnIndex, r, t]);
  return ln(() => {
    if (!s && x(d) && x(l)) {
      const h = d.model.getStarts(), m = d.duration(), w = e[l.rowIndex][l.columnIndex], y = Ti(w, h) * ot, v = new O(h.getTime() + y), E = new O(v.getTime() + m);
      o.fire("beforeUpdateEvent", {
        event: d.model.toEventObject(),
        changes: {
          start: v,
          end: E
        }
      });
    }
    u(), a();
  }, i), d;
}
function Vm({ dateMatrix: e, gridPositionFinder: t, rowInfo: n, rowIndex: r }) {
  const o = Ym({
    dateMatrix: e,
    rowInfo: n,
    gridPositionFinder: t,
    rowIndex: r
  });
  return z(o) ? null : /* @__PURE__ */ f(
    yt,
    {
      uiModel: o,
      movingLeft: o.left,
      eventHeight: Ke,
      headerHeight: gi + Mr
    }
  );
}
function Da(e, t) {
  const n = Math.max(Tr(e.getStarts(), t), 0), r = Tr(e.getEnds(), t);
  return {
    startColumnIndex: n,
    endColumnIndex: r
  };
}
function jm({
  dateMatrix: e,
  gridPositionFinder: t,
  renderedUIModels: n,
  cellWidthMap: r,
  rowIndex: o
}) {
  const i = Ce(), {
    isDraggingEnd: s,
    isDraggingCanceled: c,
    draggingEvent: u,
    clearDraggingEvent: l
  } = dn("dayGrid", "resize"), [a, d] = un(t), [p, h] = se(null), m = J(() => {
    h(null), d(), l();
  }, [d, l]), w = U(() => {
    if (z(u))
      return null;
    const v = n.map(
      ({ uiModels: N }) => N.filter(
        (M) => M.cid() === u.cid()
      )
    ), E = v.findIndex((N) => N.length > 0), T = _i(v, (N) => N.length > 0), k = Da(
      v[E][0],
      e[E]
    ), D = Da(
      v[T][0],
      e[T]
    );
    return {
      eventStartDateColumnIndex: k.startColumnIndex,
      eventStartDateRowIndex: E,
      eventEndDateColumnIndex: D.endColumnIndex,
      eventEndDateRowIndex: T,
      resizeTargetUIModelRows: v
    };
  }, [e, n, u]), y = x(w) && x(u) && x(a);
  return re(() => {
    if (y && o === w.eventStartDateRowIndex) {
      const { eventStartDateRowIndex: v, eventStartDateColumnIndex: E } = w, T = w.resizeTargetUIModelRows[v][0].clone();
      let k;
      v === a.rowIndex ? k = r[E][Math.max(E, a.columnIndex)] : v > a.rowIndex ? k = r[E][E] : (k = r[E][e[o].length - 1], T.setUIProps({ exceedRight: !0 })), h([T, k]);
    }
  }, [w, y, r, a, e, o]), re(() => {
    if (y && w.eventStartDateRowIndex < o && o < a.rowIndex) {
      const v = u.clone();
      v.setUIProps({ left: 0, exceedLeft: !0, exceedRight: !0 }), h([v, "100%"]);
    }
  }, [w, y, a, u, o]), re(() => {
    if (y && w.eventStartDateRowIndex < a.rowIndex && o === a.rowIndex) {
      const v = u.clone();
      v.setUIProps({ left: 0, exceedLeft: !0 }), h([v, r[0][a.columnIndex]]);
    }
  }, [
    w,
    y,
    r,
    a,
    u,
    o
  ]), re(() => {
    y && o > w.eventStartDateRowIndex && o > a.rowIndex && h(null);
  }, [y, a, w, o]), ln(() => {
    if (y) {
      const { eventStartDateColumnIndex: v, eventStartDateRowIndex: E } = w;
      if (!c && (a.rowIndex === E && a.columnIndex >= v || a.rowIndex > E)) {
        const k = e[a.rowIndex][a.columnIndex];
        i.fire("beforeUpdateEvent", {
          event: u.model.toEventObject(),
          changes: {
            end: k
          }
        });
      }
    }
    m();
  }, s), p;
}
function qm({
  dateMatrix: e,
  cellWidthMap: t,
  gridPositionFinder: n,
  renderedUIModels: r,
  rowIndex: o
}) {
  const i = jm({
    dateMatrix: e,
    gridPositionFinder: n,
    cellWidthMap: t,
    renderedUIModels: r,
    rowIndex: o
  });
  if (z(i))
    return null;
  const [s, c] = i;
  return /* @__PURE__ */ f("div", { className: _("weekday-events"), children: /* @__PURE__ */ f(
    yt,
    {
      uiModel: s,
      eventHeight: Kt,
      headerHeight: gi + Mr,
      resizingWidth: c
    },
    `resizing-event-${s.cid()}`
  ) });
}
const Xm = 100;
function Km(e) {
  const t = G(am), { headerHeight: n, footerHeight: r } = ie(Ac), o = ee(null), [i, s] = se(0);
  return re(() => {
    if (o.current) {
      const c = Ec(o.current).height, u = gi + (n != null ? n : Mr), l = r != null ? r : 0, a = c - u - l, d = t * (e + Ir);
      s(Math.min(a, d));
    }
  }, [r, n, e, t]), { ref: o, cellContentAreaHeight: i };
}
function Zm({ dateMatrix: e = [], rowInfo: t = [], cellWidthMap: n = [] }) {
  const [r, o] = He(), i = G(Pr), { ref: s, cellContentAreaHeight: c } = Km(Kt), { eventFilter: u, month: l, isReadOnly: a } = G(We), { narrowWeekend: d, startDayOfWeek: p } = l, h = Xm / e.length, m = U(
    () => Ai({
      container: r,
      rowsCount: e.length,
      columnsCount: e[0].length,
      narrowWeekend: d,
      startDayOfWeek: p
    }),
    [e, r, d, p]
  ), w = Ui(i, u), y = U(
    () => e.map((E) => op(E, w, d)),
    [w, e, d]
  ), v = Hi({
    type: "dayGridMonth",
    gridPositionFinder: m,
    dateCollection: e,
    dateGetter: br.getDateFromCollection,
    selectionSorter: br.sortSelection
  });
  return /* @__PURE__ */ f(
    "div",
    {
      ref: o,
      onMouseDown: Li(!a, v),
      className: _("month-daygrid"),
      children: e.map((E, T) => {
        const { uiModels: k, gridDateEventModelMap: D } = y[T];
        return /* @__PURE__ */ f(
          "div",
          {
            className: _("month-week-item"),
            style: { height: q(h) },
            ref: s,
            children: [
              /* @__PURE__ */ f("div", { className: _("weekday"), children: [
                /* @__PURE__ */ f(
                  Um,
                  {
                    gridDateEventModelMap: D,
                    week: E,
                    rowInfo: t,
                    contentAreaHeight: c
                  }
                ),
                /* @__PURE__ */ f(
                  Wm,
                  {
                    name: "month",
                    events: k,
                    contentAreaHeight: c,
                    eventHeight: Kt,
                    className: _("weekday-events")
                  }
                ),
                /* @__PURE__ */ f(
                  zm,
                  {
                    weekDates: E,
                    narrowWeekend: d,
                    rowIndex: T
                  }
                ),
                /* @__PURE__ */ f(
                  Rm,
                  {
                    rowIndex: T,
                    weekDates: E,
                    narrowWeekend: d
                  }
                )
              ] }),
              /* @__PURE__ */ f(
                qm,
                {
                  dateMatrix: e,
                  gridPositionFinder: m,
                  rowIndex: T,
                  cellWidthMap: n,
                  renderedUIModels: y
                }
              ),
              /* @__PURE__ */ f(
                Vm,
                {
                  dateMatrix: e,
                  gridPositionFinder: m,
                  rowIndex: T,
                  rowInfo: t
                }
              )
            ]
          },
          `dayGrid-events-${T}`
        );
      })
    }
  );
}
function Jm(e) {
  const { dayNames: t, startDayOfWeek: n, workweek: r } = e.month;
  return [...Array(7)].map((s, c) => (n + c) % 7).map((s) => ({
    day: s,
    label: xr(t[s])
  })).filter((s) => r ? !$e(s.day) : !0);
}
function Dl() {
  const e = G(We), { renderDate: t } = G(an), n = Jm(e), r = e.month, { narrowWeekend: o, startDayOfWeek: i, workweek: s } = r, c = U(
    () => Yc(t, r),
    [r, t]
  ), { rowStyleInfo: u, cellWidthMap: l } = U(
    () => Si(n.length, o, i, s),
    [n.length, o, i, s]
  ), a = u.map((d, p) => ae(R({}, d), {
    date: c[0][p]
  }));
  return /* @__PURE__ */ f(Bi, { className: _("month"), children: [
    /* @__PURE__ */ f(
      Ci,
      {
        type: "month",
        dayNames: n,
        options: r,
        rowStyleInfo: u
      }
    ),
    /* @__PURE__ */ f(Zm, { dateMatrix: c, rowInfo: a, cellWidthMap: l })
  ] });
}
function Qm() {
  const e = G(We), t = G(Pr), { dayGridRows: n, lastPanelType: r } = G(bc), { renderDate: o } = G(an);
  return U(
    () => ({
      options: e,
      calendar: t,
      gridRowLayout: n,
      lastPanelType: r,
      renderDate: o
    }),
    [t, n, r, e, o]
  );
}
function Sl() {
  var X, Q;
  const { options: e, calendar: t, gridRowLayout: n, lastPanelType: r, renderDate: o } = Qm(), i = ie(J((S) => S.week.dayGridLeft.width, [])), s = G(Lr), [c, u] = He(), l = e.week, { narrowWeekend: a, startDayOfWeek: d, workweek: p, hourStart: h, hourEnd: m, eventView: w, taskView: y } = l, v = U(() => Vc(o, l), [o, l]), E = _c(v, (Q = (X = e.week) == null ? void 0 : X.dayNames) != null ? Q : []), { rowStyleInfo: T, cellWidthMap: k } = Si(
    v.length,
    a,
    d,
    p
  ), D = Ui(t, e.eventFilter), N = U(() => {
    const S = () => s === "Local" ? [pe(jo(v)), Ae(rt(v))] : [pe(Nt(jo(v), -1)), Ae(Nt(rt(v), 1))], [b, W] = S();
    return Wc(v, D, {
      narrowWeekend: a,
      hourStart: h,
      hourEnd: m,
      weekStartDate: b,
      weekEndDate: W
    });
  }, [D, m, h, a, s, v]), M = U(
    () => jc(v, {
      hourStart: h,
      hourEnd: m,
      narrowWeekend: a
    }),
    [m, h, a, v]
  ), H = _l(y, w), $ = H.map((S) => {
    var W, te;
    if (S === "time")
      return null;
    const b = S;
    return /* @__PURE__ */ f(Vt, { name: b, resizable: b !== r, children: b === "allday" ? /* @__PURE__ */ f(
      rl,
      {
        events: N[b],
        rowStyleInfo: T,
        gridColWidthMap: k,
        weekDates: v,
        height: (W = n[b]) == null ? void 0 : W.height,
        options: l
      }
    ) : /* @__PURE__ */ f(
      ol,
      {
        category: b,
        events: N[b],
        weekDates: v,
        height: (te = n[b]) == null ? void 0 : te.height,
        options: l,
        gridColWidthMap: k
      }
    ) }, b);
  }), Y = U(() => H.includes("time"), [H]);
  yl(c, M.rows.length);
  const B = wl(c);
  return /* @__PURE__ */ f(Bi, { className: _("week-view"), autoAdjustPanels: !0, children: [
    /* @__PURE__ */ f(
      Vt,
      {
        name: "week-view-day-names",
        initialHeight: rc + oc * 2,
        children: /* @__PURE__ */ f(
          Ci,
          {
            type: "week",
            dayNames: E,
            marginLeft: i,
            options: l,
            rowStyleInfo: T
          }
        )
      }
    ),
    $,
    Y ? /* @__PURE__ */ f(Vt, { name: "time", autoSize: 1, ref: u, children: [
      /* @__PURE__ */ f(gl, { events: N.time, timeGridData: M }),
      /* @__PURE__ */ f(vl, { top: B })
    ] }) : null
  ] });
}
const eg = {
  month: Dl,
  week: Sl,
  day: El
};
function tg() {
  const { currentView: e } = G(an), t = U(() => eg[e] || (() => null), [e]);
  return /* @__PURE__ */ f(t, {});
}
var ng = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|^--/i, rg = /[&<>"]/;
function Sa(e) {
  var t = String(e);
  return rg.test(t) ? t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : t;
}
var Ta = function(e, t) {
  return String(e).replace(/(\n+)/g, "$1" + (t || "	"));
}, ba = function(e, t, n) {
  return String(e).length > 40 || String(e).indexOf(`
`) !== -1 || String(e).indexOf("<") !== -1;
}, Ca = {};
function og(e) {
  var t = "";
  for (var n in e) {
    var r = e[n];
    r != null && r !== "" && (t && (t += " "), t += n[0] == "-" ? n : Ca[n] || (Ca[n] = n.replace(/([A-Z])/g, "-$1").toLowerCase()), t += ": ", t += r, typeof r == "number" && ng.test(n) === !1 && (t += "px"), t += ";");
  }
  return t || void 0;
}
function rr(e, t) {
  for (var n in t) e[n] = t[n];
  return e;
}
function ii(e, t) {
  return Array.isArray(t) ? t.reduce(ii, e) : t != null && t !== !1 && e.push(t), e;
}
var ig = { shallow: !0 }, Co = [], sg = /^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/, ka = /[\s\n\\/='"\0<>]/;
function Na() {
  this.__d = !0;
}
xn.render = xn;
var ag = function(e, t) {
  return xn(e, t, ig);
}, Ia = [];
function xn(e, t, n) {
  t = t || {}, n = n || {};
  var r = P.__s;
  P.__s = !0;
  var o = Dn(e, t, n);
  return P.__c && P.__c(e, Ia), Ia.length = 0, P.__s = r, o;
}
function Dn(e, t, n, r, o, i) {
  if (e == null || typeof e == "boolean") return "";
  if (typeof e != "object") return Sa(e);
  var s = n.pretty, c = s && typeof s == "string" ? s : "	";
  if (Array.isArray(e)) {
    for (var u = "", l = 0; l < e.length; l++) s && l > 0 && (u += `
`), u += Dn(e[l], t, n, r, o, i);
    return u;
  }
  var a, d = e.type, p = e.props, h = !1;
  if (typeof d == "function") {
    if (h = !0, !n.shallow || !r && n.renderRootComponent !== !1) {
      if (d === Me) {
        var m = [];
        return ii(m, e.props.children), Dn(m, t, n, n.shallowHighOrder !== !1, o, i);
      }
      var w, y = e.__c = { __v: e, context: t, props: e.props, setState: Na, forceUpdate: Na, __d: !0, __h: [] };
      P.__b && P.__b(e);
      var v = P.__r;
      if (d.prototype && typeof d.prototype.render == "function") {
        var E = d.contextType, T = E && t[E.__c], k = E != null ? T ? T.props.value : E.__ : t;
        (y = e.__c = new d(p, k)).__v = e, y._dirty = y.__d = !0, y.props = p, y.state == null && (y.state = {}), y._nextState == null && y.__s == null && (y._nextState = y.__s = y.state), y.context = k, d.getDerivedStateFromProps ? y.state = rr(rr({}, y.state), d.getDerivedStateFromProps(y.props, y.state)) : y.componentWillMount && (y.componentWillMount(), y.state = y._nextState !== y.state ? y._nextState : y.__s !== y.state ? y.__s : y.state), v && v(e), w = y.render(y.props, y.state, y.context);
      } else for (var D = d.contextType, N = D && t[D.__c], M = D != null ? N ? N.props.value : D.__ : t, H = 0; y.__d && H++ < 25; ) y.__d = !1, v && v(e), w = d.call(e.__c, p, M);
      return y.getChildContext && (t = rr(rr({}, t), y.getChildContext())), P.diffed && P.diffed(e), Dn(w, t, n, n.shallowHighOrder !== !1, o, i);
    }
    d = (a = d).displayName || a !== Function && a.name || (function(Rt) {
      var xt = (Function.prototype.toString.call(Rt).match(/^\s*function\s+([^( ]+)/) || "")[1];
      if (!xt) {
        for (var ct = -1, Ot = Co.length; Ot--; ) if (Co[Ot] === Rt) {
          ct = Ot;
          break;
        }
        ct < 0 && (ct = Co.push(Rt) - 1), xt = "UnnamedComponent" + ct;
      }
      return xt;
    })(a);
  }
  var $, Y, B = "<" + d;
  if (p) {
    var X = Object.keys(p);
    n && n.sortAttributes === !0 && X.sort();
    for (var Q = 0; Q < X.length; Q++) {
      var S = X[Q], b = p[S];
      if (S !== "children") {
        if (!ka.test(S) && (n && n.allAttributes || S !== "key" && S !== "ref" && S !== "__self" && S !== "__source")) {
          if (S === "defaultValue") S = "value";
          else if (S === "defaultChecked") S = "checked";
          else if (S === "defaultSelected") S = "selected";
          else if (S === "className") {
            if (p.class !== void 0) continue;
            S = "class";
          } else o && /^xlink:?./.test(S) && (S = S.toLowerCase().replace(/^xlink:?/, "xlink:"));
          if (S === "htmlFor") {
            if (p.for) continue;
            S = "for";
          }
          S === "style" && b && typeof b == "object" && (b = og(b)), S[0] === "a" && S[1] === "r" && typeof b == "boolean" && (b = String(b));
          var W = n.attributeHook && n.attributeHook(S, b, t, n, h);
          if (W || W === "") B += W;
          else if (S === "dangerouslySetInnerHTML") Y = b && b.__html;
          else if (d === "textarea" && S === "value") $ = b;
          else if ((b || b === 0 || b === "") && typeof b != "function") {
            if (!(b !== !0 && b !== "" || (b = S, n && n.xml))) {
              B = B + " " + S;
              continue;
            }
            if (S === "value") {
              if (d === "select") {
                i = b;
                continue;
              }
              d === "option" && i == b && p.selected === void 0 && (B += " selected");
            }
            B = B + " " + S + '="' + Sa(b) + '"';
          }
        }
      } else $ = b;
    }
  }
  if (s) {
    var te = B.replace(/\n\s*/, " ");
    te === B || ~te.indexOf(`
`) ? s && ~B.indexOf(`
`) && (B += `
`) : B = te;
  }
  if (B += ">", ka.test(d)) throw new Error(d + " is not a valid HTML tag name in " + B);
  var he, j = sg.test(d) || n.voidElements && n.voidElements.test(d), le = [];
  if (Y) s && ba(Y) && (Y = `
` + c + Ta(Y, c)), B += Y;
  else if ($ != null && ii(he = [], $).length) {
    for (var Re = s && ~B.indexOf(`
`), wt = !1, ce = 0; ce < he.length; ce++) {
      var Be = he[ce];
      if (Be != null && Be !== !1) {
        var xe = Dn(Be, t, n, !0, d === "svg" || d !== "foreignObject" && o, i);
        if (s && !Re && ba(xe) && (Re = !0), xe) if (s) {
          var at = xe.length > 0 && xe[0] != "<";
          wt && at ? le[le.length - 1] += xe : le.push(xe), wt = at;
        } else le.push(xe);
      }
    }
    if (s && Re) for (var fn = le.length; fn--; ) le[fn] = `
` + c + Ta(le[fn], c);
  }
  if (le.length || Y) B += le.join("");
  else if (n && n.xml) return B.substring(0, B.length - 1) + " />";
  return !j || he || Y ? (s && ~B.indexOf(`
`) && (B += `
`), B = B + "</" + d + ">") : B = B.replace(/>$/, " />"), B;
}
xn.shallowRender = ag;
var ko, Ma;
function Tl() {
  if (Ma) return ko;
  Ma = 1;
  function e(t, n, r) {
    var o;
    r = r || null;
    for (o in t)
      if (t.hasOwnProperty(o) && n.call(r, t[o], o, t) === !1)
        break;
  }
  return ko = e, ko;
}
var No, Aa;
function cg() {
  if (Aa) return No;
  Aa = 1;
  var e = Tl();
  function t(n, r) {
    var o = document.createElement("img"), i = "";
    return e(r, function(s, c) {
      i += "&" + c + "=" + s;
    }), i = i.substring(1), o.src = n + "?" + i, o.style.display = "none", document.body.appendChild(o), document.body.removeChild(o), o;
  }
  return No = t, No;
}
var Io, Ra;
function lg() {
  if (Ra) return Io;
  Ra = 1;
  var e = Nr(), t = cg(), n = 10080 * 60 * 1e3;
  function r(i) {
    var s = (/* @__PURE__ */ new Date()).getTime();
    return s - i > n;
  }
  function o(i, s) {
    var c = "https://www.google-analytics.com/collect", u = location.hostname, l = "event", a = "use", d = "TOAST UI " + i + " for " + u + ": Statistics", p = window.localStorage.getItem(d);
    !e(window.tui) && window.tui.usageStatistics === !1 || p && !r(p) || (window.localStorage.setItem(d, (/* @__PURE__ */ new Date()).getTime()), setTimeout(function() {
      (document.readyState === "interactive" || document.readyState === "complete") && t(c, {
        v: 1,
        t: l,
        tid: s,
        cid: u,
        dp: u,
        dh: i,
        el: i,
        ec: a
      });
    }, 1e3));
  }
  return Io = o, Io;
}
var ug = lg();
const dg = /* @__PURE__ */ st(ug);
function xa({ theme: e, store: t, eventBus: n, children: r }) {
  return /* @__PURE__ */ f(gf, { value: n, children: /* @__PURE__ */ f(xf, { store: e, children: /* @__PURE__ */ f(lf, { store: t, children: /* @__PURE__ */ f(sh, { children: r }) }) }) });
}
const fg = "UA-129951699-1";
var Mo, Oa;
function pg() {
  if (Oa) return Mo;
  Oa = 1;
  function e(t, n) {
    var r = Object.prototype.hasOwnProperty, o, i, s, c;
    for (s = 1, c = arguments.length; s < c; s += 1) {
      o = arguments[s];
      for (i in o)
        r.call(o, i) && (t[i] = o[i]);
    }
    return t;
  }
  return Mo = e, Mo;
}
var Ao, Pa;
function hg() {
  if (Pa) return Ao;
  Pa = 1;
  function e(t) {
    return t === null;
  }
  return Ao = e, Ao;
}
var Ro, La;
function mg() {
  if (La) return Ro;
  La = 1;
  var e = Nr(), t = hg();
  function n(r) {
    return !e(r) && !t(r);
  }
  return Ro = n, Ro;
}
var xo, Ha;
function bl() {
  if (Ha) return xo;
  Ha = 1;
  function e(t) {
    return t instanceof Array;
  }
  return xo = e, xo;
}
var Oo, $a;
function gg() {
  if ($a) return Oo;
  $a = 1;
  function e(t) {
    return t instanceof Function;
  }
  return Oo = e, Oo;
}
var Po, Ba;
function vg() {
  if (Ba) return Po;
  Ba = 1;
  function e(t, n, r) {
    var o = 0, i = t.length;
    for (r = r || null; o < i && n.call(r, t[o], o, t) !== !1; o += 1)
      ;
  }
  return Po = e, Po;
}
var Lo, Fa;
function _g() {
  if (Fa) return Lo;
  Fa = 1;
  var e = bl(), t = vg(), n = Tl();
  function r(o, i, s) {
    e(o) ? t(o, i, s) : n(o, i, s);
  }
  return Lo = r, Lo;
}
var Ho, Ga;
function yg() {
  if (Ga) return Ho;
  Ga = 1;
  var e = pg(), t = mg(), n = ac(), r = sc(), o = bl(), i = gg(), s = _g(), c = /\s+/g;
  function u() {
    this.events = null, this.contexts = null;
  }
  return u.mixin = function(l) {
    e(l.prototype, u.prototype);
  }, u.prototype._getHandlerItem = function(l, a) {
    var d = { handler: l };
    return a && (d.context = a), d;
  }, u.prototype._safeEvent = function(l) {
    var a = this.events, d;
    return a || (a = this.events = {}), l && (d = a[l], d || (d = [], a[l] = d), a = d), a;
  }, u.prototype._safeContext = function() {
    var l = this.contexts;
    return l || (l = this.contexts = []), l;
  }, u.prototype._indexOfContext = function(l) {
    for (var a = this._safeContext(), d = 0; a[d]; ) {
      if (l === a[d][0])
        return d;
      d += 1;
    }
    return -1;
  }, u.prototype._memorizeContext = function(l) {
    var a, d;
    t(l) && (a = this._safeContext(), d = this._indexOfContext(l), d > -1 ? a[d][1] += 1 : a.push([l, 1]));
  }, u.prototype._forgetContext = function(l) {
    var a, d;
    t(l) && (a = this._safeContext(), d = this._indexOfContext(l), d > -1 && (a[d][1] -= 1, a[d][1] <= 0 && a.splice(d, 1)));
  }, u.prototype._bindEvent = function(l, a, d) {
    var p = this._safeEvent(l);
    this._memorizeContext(d), p.push(this._getHandlerItem(a, d));
  }, u.prototype.on = function(l, a, d) {
    var p = this;
    n(l) ? (l = l.split(c), s(l, function(h) {
      p._bindEvent(h, a, d);
    })) : r(l) && (d = a, s(l, function(h, m) {
      p.on(m, h, d);
    }));
  }, u.prototype.once = function(l, a, d) {
    var p = this;
    if (r(l)) {
      d = a, s(l, function(m, w) {
        p.once(w, m, d);
      });
      return;
    }
    function h() {
      a.apply(d, arguments), p.off(l, h, d);
    }
    this.on(l, h, d);
  }, u.prototype._spliceMatches = function(l, a) {
    var d = 0, p;
    if (o(l))
      for (p = l.length; d < p; d += 1)
        a(l[d]) === !0 && (l.splice(d, 1), p -= 1, d -= 1);
  }, u.prototype._matchHandler = function(l) {
    var a = this;
    return function(d) {
      var p = l === d.handler;
      return p && a._forgetContext(d.context), p;
    };
  }, u.prototype._matchContext = function(l) {
    var a = this;
    return function(d) {
      var p = l === d.context;
      return p && a._forgetContext(d.context), p;
    };
  }, u.prototype._matchHandlerAndContext = function(l, a) {
    var d = this;
    return function(p) {
      var h = l === p.handler, m = a === p.context, w = h && m;
      return w && d._forgetContext(p.context), w;
    };
  }, u.prototype._offByEventName = function(l, a) {
    var d = this, p = i(a), h = d._matchHandler(a);
    l = l.split(c), s(l, function(m) {
      var w = d._safeEvent(m);
      p ? d._spliceMatches(w, h) : (s(w, function(y) {
        d._forgetContext(y.context);
      }), d.events[m] = []);
    });
  }, u.prototype._offByHandler = function(l) {
    var a = this, d = this._matchHandler(l);
    s(this._safeEvent(), function(p) {
      a._spliceMatches(p, d);
    });
  }, u.prototype._offByObject = function(l, a) {
    var d = this, p;
    this._indexOfContext(l) < 0 ? s(l, function(h, m) {
      d.off(m, h);
    }) : n(a) ? (p = this._matchContext(l), d._spliceMatches(this._safeEvent(a), p)) : i(a) ? (p = this._matchHandlerAndContext(a, l), s(this._safeEvent(), function(h) {
      d._spliceMatches(h, p);
    })) : (p = this._matchContext(l), s(this._safeEvent(), function(h) {
      d._spliceMatches(h, p);
    }));
  }, u.prototype.off = function(l, a) {
    n(l) ? this._offByEventName(l, a) : arguments.length ? i(l) ? this._offByHandler(l) : r(l) && this._offByObject(l, a) : (this.events = {}, this.contexts = []);
  }, u.prototype.fire = function(l) {
    this.invoke.apply(this, arguments);
  }, u.prototype.invoke = function(l) {
    var a, d, p, h;
    if (!this.hasListener(l))
      return !0;
    for (a = this._safeEvent(l), d = Array.prototype.slice.call(arguments, 1), p = 0; a[p]; ) {
      if (h = a[p], h.handler.apply(h.context, d) === !1)
        return !1;
      p += 1;
    }
    return !0;
  }, u.prototype.hasListener = function(l) {
    return this.getListenerLength(l) > 0;
  }, u.prototype.getListenerLength = function(l) {
    var a = this._safeEvent(l);
    return a.length;
  }, Ho = u, Ho;
}
var wg = yg();
const Eg = /* @__PURE__ */ st(wg);
class Dg extends Eg {
  on(t, n) {
    return super.on(t, n), this;
  }
  off(t, n) {
    return super.off(t, n), this;
  }
  fire(t, ...n) {
    return super.fire(t, ...n), this;
  }
  once(t, n) {
    return super.once(t, n), this;
  }
}
class Gr {
  constructor(t, n = {}) {
    var r;
    this.container = be(t) ? (r = document == null ? void 0 : document.querySelector(t)) != null ? r : null : t, this.theme = Rf(n.theme), this.eventBus = new Dg(), this.store = cf(n), this.renderRange = this.calculateRenderRange(pe()), pf(), this.getStoreState().options.usageStatistics === !0 && dg("calendar", fg);
  }
  getStoreState(t) {
    const n = this.store.getState();
    return t ? n[t] : n;
  }
  getStoreDispatchers(t) {
    const n = this.store.getState().dispatch;
    return t ? n[t] : n;
  }
  /**
   * Destroys the instance.
   */
  destroy() {
    this.container && Np(this.container), this.store.clearListeners(), this.theme.clearListeners(), this.eventBus.off(), hf();
    for (const t in this)
      this.hasOwnProperty(t) && delete this[t];
  }
  calculateMonthRenderDate({
    renderDate: t,
    offset: n,
    monthOptions: r
  }) {
    let o = new O(t);
    const { visibleWeeksCount: i } = r;
    i > 0 ? o = Nt(o, n * 7 * i) : o = Td(o, n);
    const s = Yc(o, r), [[c]] = s, u = rt(rt(s));
    return {
      renderDate: o,
      renderRange: { start: c, end: u }
    };
  }
  calculateWeekRenderDate({
    renderDate: t,
    offset: n,
    weekOptions: r
  }) {
    const o = new O(t);
    o.addDate(n * 7);
    const i = Vc(o, r), [s] = i, c = rt(i);
    return {
      renderDate: o,
      renderRange: { start: s, end: c }
    };
  }
  calculateDayRenderDate({ renderDate: t, offset: n }) {
    const r = new O(t);
    r.addDate(n);
    const o = pe(r), i = Ae(r);
    return {
      renderDate: r,
      renderRange: { start: o, end: i }
    };
  }
  /**
   * Move the rendered date to the next/prev range.
   *
   * The range of movement differs depending on the current view, Basically:
   *   - In month view, it moves to the next/prev month.
   *   - In week view, it moves to the next/prev week.
   *   - In day view, it moves to the next/prev day.
   *
   * Also, the range depends on the options like how many visible weeks/months should be rendered.
   *
   * @param {number} offset The offset to move by.
   *
   * @example
   * // Move to the next month in month view.
   * calendar.move(1);
   *
   * // Move to the next year in month view.
   * calendar.move(12);
   *
   * // Move to yesterday in day view.
   * calendar.move(-1);
   */
  move(t) {
    if (z(t))
      return;
    const { currentView: n, renderDate: r } = this.getStoreState().view, { options: o } = this.getStoreState(), { setRenderDate: i } = this.getStoreDispatchers().view, s = new O(r);
    let c = {
      renderDate: s,
      renderRange: { start: new O(s), end: new O(s) }
    };
    n === "month" ? c = this.calculateMonthRenderDate({
      renderDate: r,
      offset: t,
      monthOptions: o.month
    }) : n === "week" ? c = this.calculateWeekRenderDate({
      renderDate: r,
      offset: t,
      weekOptions: o.week
    }) : n === "day" && (c = this.calculateDayRenderDate({ renderDate: r, offset: t })), i(c.renderDate), this.renderRange = c.renderRange;
  }
  /**********
   * CRUD Methods
   **********/
  /**
   * Create events and render calendar.
   * @param {Array.<EventObject>} events - list of {@link EventObject}
   * @example
   * calendar.createEvents([
   *   {
   *     id: '1',
   *     calendarId: '1',
   *     title: 'my event',
   *     category: 'time',
   *     dueDateClass: '',
   *     start: '2018-01-18T22:30:00+09:00',
   *     end: '2018-01-19T02:30:00+09:00',
   *   },
   *   {
   *     id: '2',
   *     calendarId: '1',
   *     title: 'second event',
   *     category: 'time',
   *     dueDateClass: '',
   *     start: '2018-01-18T17:30:00+09:00',
   *     end: '2018-01-19T17:31:00+09:00',
   *   },
   * ]);
   */
  createEvents(t) {
    const { createEvents: n } = this.getStoreDispatchers("calendar");
    n(t);
  }
  getEventModel(t, n) {
    const { events: r } = this.getStoreState("calendar");
    return r.find(
      ({ id: o, calendarId: i }) => o === t && i === n
    );
  }
  /**
   * Get an {@link EventObject} with event's id and calendar's id.
   *
   * @param {string} eventId - event's id
   * @param {string} calendarId - calendar's id of the event
   * @returns {EventObject|null} event. If the event can't be found, it returns null.
   *
   * @example
   * const event = calendar.getEvent(eventId, calendarId);
   *
   * console.log(event.title);
   */
  getEvent(t, n) {
    var r, o;
    return (o = (r = this.getEventModel(t, n)) == null ? void 0 : r.toEventObject()) != null ? o : null;
  }
  /**
   * Update an event.
   *
   * @param {string} eventId - ID of an event to update
   * @param {string} calendarId - The calendarId of the event to update
   * @param {EventObject} changes - The new {@link EventObject} data to apply to the event
   *
   * @example
   * calendar.on('beforeUpdateEvent', function ({ event, changes }) {
   *   const { id, calendarId } = event;
   *
   *   calendar.updateEvent(id, calendarId, changes);
   * });
   */
  updateEvent(t, n, r) {
    const { updateEvent: o } = this.getStoreDispatchers("calendar"), i = this.getEventModel(t, n);
    i && o({ event: i, eventData: r });
  }
  /**
   * Delete an event.
   *
   * @param {string} eventId - event's id to delete
   * @param {string} calendarId - The CalendarId of the event to delete
   */
  deleteEvent(t, n) {
    const { deleteEvent: r } = this.getStoreDispatchers("calendar"), o = this.getEventModel(t, n);
    o && r(o);
  }
  /**********
   * General Methods
   **********/
  /**
   * Set events' visibility by calendar ID
   *
   * @param {string|Array.<string>} calendarId - The calendar id or ids to change visibility
   * @param {boolean} isVisible - If set to true, show the events. If set to false, hide the events.
   */
  setCalendarVisibility(t, n) {
    const { setCalendarVisibility: r } = this.getStoreDispatchers("calendar"), o = Array.isArray(t) ? t : [t];
    r(o, n);
  }
  /**
   * Render the calendar.
   *
   * @example
   * calendar.render();
   *
   * @example
   * // Re-render the calendar when resizing a window.
   * window.addEventListener('resize', () => {
   *   calendar.render();
   * });
   */
  render() {
    return x(this.container) && pr(
      /* @__PURE__ */ f(xa, { theme: this.theme, store: this.store, eventBus: this.eventBus, children: this.getComponent() }),
      this.container
    ), this;
  }
  /**
   * For SSR(Server Side Rendering), Return the HTML string of the whole calendar.
   *
   * @returns {string} HTML string
   */
  renderToString() {
    return xn(
      /* @__PURE__ */ f(xa, { theme: this.theme, store: this.store, eventBus: this.eventBus, children: this.getComponent() })
    );
  }
  /**
   * Delete all events and clear view
   *
   * @example
   * calendar.clear();
   */
  clear() {
    const { clearEvents: t } = this.getStoreDispatchers("calendar");
    t();
  }
  /**
   * Scroll to current time on today in case of daily, weekly view.
   * Nothing happens in the monthly view.
   *
   * @example
   * function onNewEvents(events) {
   *   calendar.createEvents(events);
   *   calendar.scrollToNow('smooth');
   * }
   */
  scrollToNow(t = "auto") {
    this.eventBus.fire("scrollToNow", t);
  }
  calculateRenderRange(t) {
    const { currentView: n } = this.getStoreState().view, { options: r } = this.getStoreState(), o = new O(t);
    let i = { start: new O(o), end: new O(o) };
    return n === "month" ? i = this.calculateMonthRenderDate({
      renderDate: t,
      offset: 0,
      monthOptions: r.month
    }).renderRange : n === "week" ? i = this.calculateWeekRenderDate({
      renderDate: t,
      offset: 0,
      weekOptions: r.week
    }).renderRange : n === "day" && (i = this.calculateDayRenderDate({ renderDate: t, offset: 0 }).renderRange), i;
  }
  /**
   * Move to today.
   *
   * @example
   * function onClickTodayBtn() {
   *   calendar.today();
   * }
   */
  today() {
    const { setRenderDate: t } = this.getStoreDispatchers().view, n = new O();
    t(n), this.renderRange = this.calculateRenderRange(n);
  }
  /**
   * Move to specific date.
   *
   * @param {Date|string|number|TZDate} date - The date to move. it should be eligible parameter to create a `Date` instance if `date` is string or number.
   * @example
   * calendar.on('clickDayName', (event) => {
   *   if (calendar.getViewName() === 'week') {
   *     const dateToMove = new Date(event.date);
   *
   *     calendar.setDate(dateToMove);
   *     calendar.changeView('day');
   *   }
   * });
   */
  setDate(t) {
    const { setRenderDate: n } = this.getStoreDispatchers("view"), r = new O(t);
    n(r), this.renderRange = this.calculateRenderRange(r);
  }
  /**
   * Move the calendar forward to the next range.
   *
   * @example
   * function moveToNextOrPrevRange(offset) {
   *   if (offset === -1) {
   *     calendar.prev();
   *   } else if (offset === 1) {
   *     calendar.next();
   *   }
   * }
   */
  next() {
    this.move(1);
  }
  /**
   * Move the calendar backward to the previous range.
   *
   * @example
   * function moveToNextOrPrevRange(offset) {
   *   if (offset === -1) {
   *     calendar.prev();
   *   } else if (offset === 1) {
   *     calendar.next();
   *   }
   * }
   */
  prev() {
    this.move(-1);
  }
  /**
   * Change color values of events belong to a certain calendar.
   *
   * @param {string} calendarId - The calendar ID
   * @param {object} colorOptions - The color values of the calendar
   *   @param {string} colorOptions.color - The text color of the events
   *   @param {string} colorOptions.borderColor - Left border color of events
   *   @param {string} colorOptions.backgroundColor - Background color of events
   *   @param {string} colorOptions.dragBackgroundColor - Background color of events during dragging
   *
   * @example
   * calendar.setCalendarColor('1', {
   *     color: '#e8e8e8',
   *     backgroundColor: '#585858',
   *     borderColor: '#a1b56c',
   *     dragBackgroundColor: '#585858',
   * });
   * calendar.setCalendarColor('2', {
   *     color: '#282828',
   *     backgroundColor: '#dc9656',
   *     borderColor: '#a1b56c',
   *     dragBackgroundColor: '#dc9656',
   * });
   * calendar.setCalendarColor('3', {
   *     color: '#a16946',
   *     backgroundColor: '#ab4642',
   *     borderColor: '#a1b56c',
   *     dragBackgroundColor: '#ab4642',
   * });
   */
  setCalendarColor(t, n) {
    const { setCalendarColor: r } = this.getStoreDispatchers().calendar;
    r(t, n);
  }
  /**
   * Change current view type.
   *
   * @param {string} viewName - The new view name to change to. Available values are 'month', 'week', 'day'.
   *
   * @example
   * // change to daily view
   * calendar.changeView('day');
   *
   * // change to weekly view
   * calendar.changeView('week');
   *
   * // change to monthly view
   * calendar.changeView('month');
   */
  changeView(t) {
    const { changeView: n } = this.getStoreDispatchers("view");
    n(t), this.renderRange = this.calculateRenderRange(this.getDate());
  }
  /**
   * Get the DOM element of the event by event id and calendar id
   *
   * @param {string} eventId - ID of event
   * @param {string} calendarId - calendarId of event
   * @returns {HTMLElement} event element if found or null
   *
   * @example
   * const element = calendar.getElement(eventId, calendarId);
   *
   * console.log(element);
   */
  getElement(t, n) {
    return this.getEvent(t, n) && this.container ? this.container.querySelector(
      `[data-event-id="${t}"][data-calendar-id="${n}"]`
    ) : null;
  }
  /**
   * Set the theme of the calendar.
   *
   * @param {Theme} theme - The theme object to apply. For more information, see {@link https://github.com/nhn/tui.calendar/blob/main/docs/en/apis/theme.md|Theme} in guide.
   *
   * @example
   * calendar.setTheme({
   *   common: {
   *     gridSelection: {
   *       backgroundColor: '#333',
   *     },
   *   },
   *   week: {
   *     nowIndicatorLabel: {
   *       color: '#00FF00',
   *     },
   *   },
   *   month: {
   *     dayName: {
   *       borderLeft: '1px solid #e5e5e5',
   *     },
   *   },
   * });
   */
  setTheme(t) {
    const { setTheme: n } = this.theme.getState().dispatch;
    n(t);
  }
  /**
   * Get current options.
   *
   * @returns {Options} - The current options of the instance
   */
  getOptions() {
    const { options: t, template: n } = this.getStoreState(), i = this.theme.getState(), { dispatch: r } = i, o = Yn(i, ["dispatch"]);
    return ae(R({}, t), {
      template: n,
      theme: o
    });
  }
  /**
   * Set options of calendar. For more information, see {@link https://github.com/nhn/tui.calendar/blob/main/docs/en/apis/options.md|Options} in guide.
   *
   * @param {Options} options - The options to set
   */
  setOptions(t) {
    const u = t, { theme: n, template: r } = u, o = Yn(u, ["theme", "template"]), { setTheme: i } = this.theme.getState().dispatch, {
      options: { setOptions: s },
      template: { setTemplate: c }
    } = this.getStoreDispatchers();
    x(n) && i(n), x(r) && c(r), s(o);
  }
  /**
   * Get current rendered date. (see {@link TZDate} for further information)
   *
   * @returns {TZDate}
   */
  getDate() {
    const { renderDate: t } = this.getStoreState().view;
    return t;
  }
  /**
   * Start time of rendered date range. (see {@link TZDate} for further information)
   *
   * @returns {TZDate}
   */
  getDateRangeStart() {
    return this.renderRange.start;
  }
  /**
   * End time of rendered date range. (see {@link TZDate} for further information)
   *
   * @returns {TZDate}
   */
  getDateRangeEnd() {
    return this.renderRange.end;
  }
  /**
   * Get current view name('day', 'week', 'month').
   *
   * @returns {string} current view name ('day', 'week', 'month')
   */
  getViewName() {
    const { currentView: t } = this.getStoreState("view");
    return t;
  }
  /**
   * Set calendar list.
   *
   * @param {CalendarInfo[]} calendars - list of calendars
   */
  setCalendars(t) {
    const { setCalendars: n } = this.getStoreDispatchers().calendar;
    n(t);
  }
  // TODO: specify position of popup
  /**
   * Open event form popup with predefined form values.
   *
   * @param {EventObject} event - The predefined {@link EventObject} data to show in form.
   */
  openFormPopup(t) {
    const { showFormPopup: n } = this.getStoreDispatchers().popup, r = new wr(t), { title: o, location: i, start: s, end: c, isAllday: u, isPrivate: l, state: a } = r;
    n({
      isCreationPopup: !0,
      event: r,
      title: o,
      location: i,
      start: s,
      end: c,
      isAllday: u,
      isPrivate: l,
      eventState: a
    });
  }
  clearGridSelections() {
    const { clearAll: t } = this.getStoreDispatchers().gridSelection;
    t();
  }
  fire(t, ...n) {
    return this.eventBus.fire(t, ...n), this;
  }
  off(t, n) {
    return this.eventBus.off(t, n), this;
  }
  on(t, n) {
    return this.eventBus.on(t, n), this;
  }
  once(t, n) {
    return this.eventBus.once(t, n), this;
  }
}
function Sg(e) {
  return !!Object.values(bm).find((t) => t === e);
}
class kg extends Gr {
  constructor(t, n = {}) {
    super(t, n);
    const { defaultView: r = "week" } = n;
    if (!Sg(r))
      throw new ed(r);
    this.render();
  }
  getComponent() {
    return /* @__PURE__ */ f(tg, {});
  }
}
class Ng extends Gr {
  constructor(t, n = {}) {
    super(t, n), this.render();
  }
  getComponent() {
    return /* @__PURE__ */ f(El, {});
  }
}
class Ig extends Gr {
  constructor(t, n = {}) {
    super(t, n), this.render();
  }
  getComponent() {
    return /* @__PURE__ */ f(Dl, {});
  }
  /**
   * Hide the more view
   */
  hideMoreView() {
    const { hideSeeMorePopup: t } = this.getStoreDispatchers().popup;
    t();
  }
}
class Mg extends Gr {
  constructor(t, n = {}) {
    super(t, n), this.render();
  }
  getComponent() {
    return /* @__PURE__ */ f(Sl, {});
  }
}
export {
  Ng as Day,
  Ig as Month,
  O as TZDate,
  Mg as Week,
  kg as default
};
