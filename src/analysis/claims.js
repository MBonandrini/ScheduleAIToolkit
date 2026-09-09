
import {whyDidDateMove} from "./comparison.js?v=1.2.0";
import {traceToMilestone} from "./network.js?v=1.2.0";
export function buildDelayEventFile({event,current,previous,documents=[]}){
  const impacted=(event.activityIds||[]).map(id=>current.activities.find(a=>a.id===id)).filter(Boolean);
  const movement=impacted.map(a=>whyDidDateMove(previous,current,a.id));
  const milestone=(event.milestoneId&&current.activities.find(a=>a.id===event.milestoneId))||null;
  const trace=milestone?traceToMilestone(current,milestone.id):null;
  return {
    title:event.title||"Delay Event",eventDate:event.date||"",description:event.description||"",
    notice:event.notice||"",instruction:event.instruction||"",clauseRefs:event.clauseRefs||[],
    impactedActivities:impacted,movement,drivingTrace:trace,
    evidenceDocuments:documents.filter(d=>!event.documentIds?.length||event.documentIds.includes(d.id)),
    disclaimer:"Analytical evidence pack only; contractual entitlement and legal conclusions require professional review."
  };
}
