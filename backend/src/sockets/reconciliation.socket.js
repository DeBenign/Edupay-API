const initReconciliationSocket=(io)=>{ io.on('connection',s=>{ s.on('join:school',id=>s.join(`school:${id}`)); s.on('join:student',id=>s.join(`student:${id}`)); }); };
const emitReconciliationEvent=(io,schoolId,data)=>{ if(io) io.to(`school:${schoolId}`).emit('payment:reconciled',{...data,timestamp:new Date().toISOString()}); };
module.exports={initReconciliationSocket,emitReconciliationEvent};
