const paginate=(q={})=>{ const page=Math.max(parseInt(q.page)||1,1); const limit=Math.min(parseInt(q.limit)||20,100); const skip=(page-1)*limit; const buildPagination=(total)=>({page,limit,totalCount:total,totalPages:Math.ceil(total/limit),hasNextPage:page<Math.ceil(total/limit),hasPrevPage:page>1}); return{skip,limit,buildPagination}; };
module.exports={paginate};
