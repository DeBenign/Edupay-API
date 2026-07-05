const success    = (res, data=null, msg='Success', code=200)       => res.status(code).json({ success:true, message:msg, data });
const created    = (res, data=null, msg='Created successfully')     => success(res, data, msg, 201);
const error      = (res, msg='An error occurred', code=500, errs=null) => { const r={success:false,message:msg}; if(errs) r.errors=errs; return res.status(code).json(r); };
const notFound   = (res, msg='Resource not found')                 => error(res, msg, 404);
const unauthorized=(res, msg='Unauthorized')                       => error(res, msg, 401);
const forbidden  = (res, msg='Access denied')                      => error(res, msg, 403);
const badRequest = (res, msg='Bad request', errs=null)             => error(res, msg, 400, errs);
const paginated  = (res, data, pagination, msg='Success')          => res.status(200).json({ success:true, message:msg, data, pagination });
module.exports   = { success, created, error, notFound, unauthorized, forbidden, badRequest, paginated };
