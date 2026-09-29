const REGISTRATIONS_API_PATH = /^\/data\/public\/invite\/[^/]+\/registrations\/?$/

export function corsOptionsForRequest(req, appOrigin) {
  if (REGISTRATIONS_API_PATH.test(req.path)) {
    return {
      origin: '*',
      credentials: false,
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: ['X-API-Key', 'Accept', 'Content-Type'],
      maxAge: 86400,
    }
  }

  return {
    origin: appOrigin,
    credentials: true,
  }
}
