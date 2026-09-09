
const STAGES=[
  ["Design",/design|engineering|submittal|drawing/i],
  ["Procurement",/procure|delivery|manufactur|vendor|switchgear|generator|ups/i],
  ["Construction",/install|construction|containment|cable|pipe|duct|fit.?out/i],
  ["Energisation",/energ|power on|mv|lv/i],
  ["L1",/\bl1\b|level 1/i],["L2",/\bl2\b|level 2/i],["L3",/\bl3\b|level 3/i],
  ["L4",/\bl4\b|level 4|functional test/i],["L5",/\bl5\b|level 5|integrated test|ist/i],
  ["Handover",/handover|turnover|completion|pc\b|ready for service/i]
];
export function dataCentreReadiness(schedule){
  return STAGES.map(([stage,rx])=>{
    const acts=schedule.activities.filter(a=>rx.test(`${a.name} ${a.wbsPath}`));
    const complete=acts.filter(a=>a.percent>=100).length,critical=acts.filter(a=>a.critical||a.totalFloat<=0).length;
    return {stage,activities:acts.length,complete,progress:acts.length?acts.reduce((n,a)=>n+a.percent,0)/acts.length:0,critical};
  });
}
export function readinessGates(schedule){
  const gates=[
    ["Energisation",/energ|power on/i],
    ["Mechanical Completion",/mechanical completion|\bmc\b/i],
    ["L4 Complete",/l4.*complete|functional.*complete/i],
    ["IST Complete",/ist.*complete|integrated.*complete/i],
    ["Handover",/handover|ready for service|practical completion/i]
  ];
  return gates.map(([name,rx])=>{
    const a=schedule.activities.filter(x=>x.milestone&&rx.test(`${x.name} ${x.wbsPath}`)).sort((a,b)=>new Date(a.currentFinish||a.finish)-new Date(b.currentFinish||b.finish))[0];
    return {name,activity:a||null};
  });
}
