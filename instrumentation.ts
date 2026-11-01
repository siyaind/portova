import type {Instrumentation} from 'next';
export const onRequestError:Instrumentation.onRequestError = (_error,request,context) => {
  // Do not send request headers, bodies, wallet signatures, or SQL error messages to logs.
  console.error(JSON.stringify({event:'unhandled_request_error',requestId:crypto.randomUUID(),route:context.routePath,method:request.method,at:new Date().toISOString()}));
};
