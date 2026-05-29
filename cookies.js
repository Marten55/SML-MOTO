/**
 * Cookie utility — Secure, SameSite-aware
 * HttpOnly must be added server-side via Set-Cookie header; JS has no access to those cookies.
 */

const Cookies = (() => {
  const DEFAULTS = {
    secure: true,        // HTTPS only
    sameSite: 'Lax',    // CSRF protection; use 'None' only for cross-site with Secure
    path: '/',
  };

  function serialize(name, value, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (opts.maxAge != null) cookie += `; Max-Age=${opts.maxAge}`;
    if (opts.expires instanceof Date) cookie += `; Expires=${opts.expires.toUTCString()}`;
    if (opts.path) cookie += `; Path=${opts.path}`;
    if (opts.domain) cookie += `; Domain=${opts.domain}`;
    if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
    if (opts.secure) cookie += '; Secure';
    // HttpOnly cannot be set from JavaScript — set it in your server's Set-Cookie header

    return cookie;
  }

  function set(name, value, options = {}) {
    document.cookie = serialize(name, value, options);
  }

  function get(name) {
    const key = encodeURIComponent(name) + '=';
    const pair = document.cookie.split('; ').find(c => c.startsWith(key));
    return pair ? decodeURIComponent(pair.slice(key.length)) : null;
  }

  function remove(name, options = {}) {
    set(name, '', { ...options, maxAge: 0 });
  }

  return { set, get, remove };
})();

export default Cookies;
