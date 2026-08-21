const ProjectControlsCore = (() => {
    "use strict";

    const VERSION = "3.0.0";
    const MODEL_VERSION = "1.0";

    const documents = (() => {
        let pdfModulePromise = null;
        let mammothPromise = null;

        function extensionOf(fileOrName){
            const name = typeof fileOrName === "string"
                ? fileOrName
                : (fileOrName?.name || "");
            return name.includes(".")
                ? name.split(".").pop().toLowerCase()
                : "";
        }

        async function ensurePDF(){
            if(!pdfModulePromise){
                pdfModulePromise = import(
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"
                );
            }
            return await pdfModulePromise;
        }

        async function ensureMammoth(){
            if(window.mammoth) return window.mammoth;
            if(!mammothPromise){
                mammothPromise = new Promise((resolve,reject)=>{
                    const script = document.createElement("script");
                    script.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js";
                    script.async = true;
                    script.onload = () => resolve(window.mammoth);
                    script.onerror = () => reject(new Error("Could not load Mammoth DOCX parser."));
                    document.head.appendChild(script);
                });
            }
            return await mammothPromise;
        }

        async function extractText(file){
            if(!file) throw new Error("No file supplied.");
            const ext = extensionOf(file);

            if(["txt","md","csv","json","html","htm","xml","xer","log"].includes(ext)){
                return await file.text();
            }

            if(ext === "pdf"){
                const pdfjsLib = await ensurePDF();
                const data = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({data}).promise;
                const chunks = new Array(pdf.numPages);

                for(let pageNumber=1; pageNumber<=pdf.numPages; pageNumber++){
                    const page = await pdf.getPage(pageNumber);
                    const content = await page.getTextContent();
                    chunks[pageNumber-1] = content.items.map(item=>item.str).join(" ");
                    page.cleanup?.();
                }

                pdf.cleanup?.();
                return chunks.join("\n\n");
            }

            if(ext === "docx"){
                const mammoth = await ensureMammoth();
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({arrayBuffer});
                return result.value || "";
            }

            throw new Error(`Unsupported file type: .${ext || "unknown"}`);
        }

        return {
            extensionOf,
            extractText,
            ensurePDF,
            ensureMammoth
        };
    })();

    const schedule = (() => {
function parseScheduleFile(file,text){

    const extension =
        file.name.split(".").pop().toLowerCase();

    if(extension === "xer"){
        return parseXER(
            file.name,
            text
        );
    }

    return parseMSProjectXML(
        file.name,
        text
    );
}

function parseXER(fileName,text){

    const rows = {
        __fields:{}
    };

    const lines =
        text
            .replace(/\r/g,"")
            .split("\n");

    let currentTable = null;

    for(const line of lines){

        if(!line.trim())
            continue;

        const parts =
            splitXERLine(
                line
            );

        if(!parts.length)
            continue;

        if(parts[0] === "%T"){

            currentTable =
                parts[1];

            rows[currentTable] =
                rows[currentTable] || [];

            continue;
        }

        if(parts[0] === "%F"){

            rows.__fields[currentTable] =
                parts.slice(1);

            continue;
        }

        if(
            parts[0] === "%R" &&
            currentTable
        ){

            const fields =
                rows.__fields[currentTable] ||
                [];

            const obj = {};

            fields.forEach(
                (field,index)=>{

                    obj[field] =
                        parts[index+1] ??
                        "";
                }
            );

            rows[currentTable].push(
                obj
            );
        }
    }

    const projects =
        rows.PROJECT || [];

    const activities =
        rows.TASK || [];

    const relationships =
        rows.TASKPRED || [];

    const resources =
        rows.TASKRSRC || [];

    const wbsRows =
        rows.PROJWBS || [];

    const calendarRows =
        rows.CALENDAR || [];

    const codeTypeRows =
        rows.ACTVTYPE ||
        rows.ACTVCODETYPE ||
        [];

    const codeRows =
        rows.ACTVCODE || [];

    const taskCodeRows =
        rows.TASKACTV || [];

    const schedules = [];

    const projectList =
        projects.length
            ? projects
            : [{
                proj_id:"xer-project",
                proj_short_name:
                    fileName.replace(
                        /\.xer$/i,
                        ""
                    ),
                plan_start_date:"",
                plan_end_date:""
            }];

    projectList.forEach(
        project=>{

            const projectId =
                project.proj_id ||
                crypto.randomUUID();

            const projectName =
                project.proj_short_name ||
                project.proj_name ||
                `P6 Schedule ${projectId}`;

            const projectWBSRows =
                wbsRows.filter(
                    row =>
                        !row.proj_id ||
                        row.proj_id === projectId
                );

            const wbsLookup =
                buildP6WBSLookup(
                    projectWBSRows
                );

            const calendarLookup =
                buildP6CalendarLookup(
                    calendarRows
                );

            const activityCodeLookup =
                buildP6ActivityCodeLookup(
                    codeTypeRows,
                    codeRows,
                    taskCodeRows
                );

            const projectActivities =
                activities.filter(
                    a =>
                        !a.proj_id ||
                        a.proj_id === projectId
                );

            const projectTaskIds =
                new Set(
                    projectActivities
                        .map(
                            a=>a.task_id
                        )
                        .filter(Boolean)
                );

            const projectResources =
                resources.filter(
                    r =>
                        projectTaskIds.has(
                            r.task_id
                        )
                );

            const acts =
                projectActivities.map(
                    (a,index)=>
                        normaliseP6Activity(
                            a,
                            index,
                            projectResources,
                            wbsLookup,
                            calendarLookup,
                            activityCodeLookup
                        )
                );

            const byUid =
                new Map(
                    acts.map(
                        a=>[
                            String(a.uid),
                            a
                        ]
                    )
                );

            const relationRows =
                relationships.filter(
                    r =>
                        byUid.has(
                            String(r.task_id)
                        ) &&
                        byUid.has(
                            String(r.pred_task_id)
                        )
                );

            const relations =
                relationRows.map(
                    r=>{

                        const pred =
                            byUid.get(
                                String(
                                    r.pred_task_id
                                )
                            );

                        const succ =
                            byUid.get(
                                String(
                                    r.task_id
                                )
                            );

                        return {
                            predecessorUid:
                                String(
                                    r.pred_task_id
                                ),
                            successorUid:
                                String(
                                    r.task_id
                                ),
                            predecessor:
                                pred?.id ||
                                String(
                                    r.pred_task_id
                                ),
                            successor:
                                succ?.id ||
                                String(
                                    r.task_id
                                ),
                            type:
                                normaliseP6RelationshipType(
                                    r.pred_type
                                ),
                            lag:
                                parseNumber(
                                    r.lag_hr_cnt
                                ) / 8,
                            raw:r
                        };
                    }
                );

            acts.forEach(
                activity=>{

                    activity.predecessors =
                        relations
                            .filter(
                                r =>
                                    r.successorUid ===
                                    String(
                                        activity.uid
                                    )
                            )
                            .map(
                                r=>r.predecessor
                            );

                    activity.successors =
                        relations
                            .filter(
                                r =>
                                    r.predecessorUid ===
                                    String(
                                        activity.uid
                                    )
                            )
                            .map(
                                r=>r.successor
                            );

                    activity.predecessorLinks =
                        relations.filter(
                            r =>
                                r.successorUid ===
                                String(activity.uid)
                        );

                    activity.successorLinks =
                        relations.filter(
                            r =>
                                r.predecessorUid ===
                                String(activity.uid)
                        );
                }
            );

            schedules.push({
                id:crypto.randomUUID(),
                source:"Primavera P6",
                format:"XER",
                extension:"xer",
                name:projectName,
                projectId,
                statusDate:
                    parseDate(
                        project.last_recalc_date ||
                        project.data_date ||
                        project.add_date ||
                        project.plan_start_date
                    ),
                plannedStart:
                    parseDate(
                        project.plan_start_date
                    ),
                plannedFinish:
                    parseDate(
                        project.plan_end_date
                    ),
                activities:acts,
                relationships:relations,
                wbs:
                    [...wbsLookup.values()],
                calendars:
                    [...calendarLookup.values()],
                rawProject:project,
                expanded:false
            });
        }
    );

    return {
        fileName,
        extension:"xer",
        text,
        schedules
    };
}

function splitXERLine(line){

    const result = [];

    let current = "";
    let quoted = false;

    for(
        let i=0;
        i<line.length;
        i++
    ){

        const c =
            line[i];

        if(c === '"'){

            quoted =
                !quoted;

            continue;
        }

        if(
            c === "\t" &&
            !quoted
        ){

            result.push(
                current
            );

            current = "";

        }else{

            current += c;
        }
    }

    result.push(
        current
    );

    return result;
}

function buildP6WBSLookup(rows){

    const lookup =
        new Map();

    rows.forEach(
        row=>{

            const id =
                String(
                    row.wbs_id ||
                    row.proj_node_id ||
                    crypto.randomUUID()
                );

            lookup.set(
                id,
                {
                    id,
                    parentId:
                        String(
                            row.parent_wbs_id ||
                            row.parent_wbs_id_fk ||
                            ""
                        ),
                    code:
                        row.wbs_short_name ||
                        row.wbs_code ||
                        "",
                    name:
                        row.wbs_name ||
                        row.wbs_short_name ||
                        "WBS",
                    path:""
                }
            );
        }
    );

    const resolvePath =
        (id,visited=new Set())=>{

            const node =
                lookup.get(
                    String(id)
                );

            if(!node)
                return "";

            if(node.path)
                return node.path;

            if(visited.has(node.id))
                return node.name;

            visited.add(
                node.id
            );

            const parentPath =
                node.parentId &&
                lookup.has(
                    node.parentId
                )
                    ? resolvePath(
                        node.parentId,
                        visited
                    )
                    : "";

            node.path =
                [
                    parentPath,
                    node.code ||
                    node.name
                ]
                    .filter(Boolean)
                    .join(" / ");

            return node.path;
        };

    lookup.forEach(
        node=>
            resolvePath(
                node.id
            )
    );

    return lookup;
}

function buildP6CalendarLookup(rows){

    const lookup =
        new Map();

    rows.forEach(
        row=>{

            const id =
                String(
                    row.clndr_id ||
                    ""
                );

            if(!id)
                return;

            lookup.set(
                id,
                {
                    id,
                    name:
                        row.clndr_name ||
                        `Calendar ${id}`,
                    type:
                        row.clndr_type ||
                        "",
                    hoursPerDay:
                        parseNumber(
                            row.day_hr_cnt
                        ) || 8,
                    hoursPerWeek:
                        parseNumber(
                            row.week_hr_cnt
                        ) || 40,
                    defaultFlag:
                        row.default_flag ||
                        "",
                    lastChange:
                        parseDate(
                            row.last_chng_date
                        )
                }
            );
        }
    );

    return lookup;
}

function buildP6ActivityCodeLookup(
    typeRows,
    codeRows,
    taskCodeRows
){

    const typeLookup =
        new Map();

    typeRows.forEach(
        row=>{

            const id =
                String(
                    row.actv_code_type_id ||
                    row.actvtype_id ||
                    row.code_type_id ||
                    ""
                );

            if(id){

                typeLookup.set(
                    id,
                    row.actv_code_type ||
                    row.actv_code_type_name ||
                    row.actvtype_name ||
                    row.code_type_name ||
                    row.actv_code_name ||
                    "Activity code"
                );
            }
        }
    );

    const codeLookup =
        new Map();

    codeRows.forEach(
        row=>{

            const id =
                String(
                    row.actv_code_id ||
                    row.code_id ||
                    ""
                );

            if(!id)
                return;

            const typeId =
                String(
                    row.actv_code_type_id ||
                    row.actvtype_id ||
                    row.code_type_id ||
                    ""
                );

            codeLookup.set(
                id,
                {
                    id,
                    typeId,
                    type:
                        typeLookup.get(
                            typeId
                        ) ||
                        "Activity code",
                    code:
                        row.actv_code_name ||
                        row.short_name ||
                        row.actv_code ||
                        "",
                    description:
                        row.actv_code_desc ||
                        row.description ||
                        ""
                }
            );
        }
    );

    const byTask =
        new Map();

    taskCodeRows.forEach(
        row=>{

            const taskId =
                String(
                    row.task_id ||
                    ""
                );

            const code =
                codeLookup.get(
                    String(
                        row.actv_code_id ||
                        row.code_id ||
                        ""
                    )
                );

            if(
                !taskId ||
                !code
            ){
                return;
            }

            if(!byTask.has(taskId)){
                byTask.set(
                    taskId,
                    []
                );
            }

            byTask
                .get(taskId)
                .push(
                    code
                );
        }
    );

    return byTask;
}

function normaliseP6RelationshipType(type){

    const value =
        String(
            type || "FS"
        ).toUpperCase();

    const map = {
        PR_FS:"FS",
        PR_SS:"SS",
        PR_FF:"FF",
        PR_SF:"SF"
    };

    return map[value] ||
        value.replace(
            /^PR_/,
            ""
        ) ||
        "FS";
}

function normaliseP6Activity(
    a,
    index,
    resources,
    wbsLookup,
    calendarLookup,
    activityCodeLookup
){

    const uid =
        String(
            a.task_id ||
            a.task_code ||
            `P6-${index+1}`
        );

    const id =
        String(
            a.task_code ||
            a.task_id ||
            `P6-${index+1}`
        );

    const name =
        a.task_name ||
        a.task_code ||
        `Activity ${index+1}`;

    const actualStart =
        parseDate(
            a.act_start_date
        );

    const actualFinish =
        parseDate(
            a.act_end_date
        );

    const currentStart =
        parseDate(
            a.restart_date ||
            a.early_start_date ||
            a.start_date ||
            a.act_start_date ||
            a.target_start_date
        );

    const currentFinish =
        parseDate(
            a.reend_date ||
            a.early_end_date ||
            a.end_date ||
            a.act_end_date ||
            a.target_end_date
        );

    const baselineStart =
        parseDate(
            a.target_start_date ||
            a.baseline_start_date
        );

    const baselineFinish =
        parseDate(
            a.target_end_date ||
            a.baseline_finish_date
        );

    const duration =
        parseDuration(
            a.target_drtn_hr_cnt ||
            a.orig_drtn_hr_cnt ||
            a.remain_drtn_hr_cnt
        );

    const remaining =
        parseDuration(
            a.remain_drtn_hr_cnt
        );

    const percent =
        parseNumber(
            a.phys_complete_pct ??
            a.complete_pct ??
            0
        );

    const totalFloat =
        parseDuration(
            a.total_float_hr_cnt ??
            0
        );

    const freeFloat =
        parseDuration(
            a.free_float_hr_cnt ??
            0
        );

    const taskResources =
        resources.filter(
            r =>
                String(
                    r.task_id
                ) === uid
        );

    const resourceBudget =
        taskResources.reduce(
            (sum,r)=>
                sum +
                parseNumber(
                    r.target_cost ||
                    r.target_qty_cost ||
                    r.budgeted_cost ||
                    0
                ),
            0
        );

    const resourceActual =
        taskResources.reduce(
            (sum,r)=>
                sum +
                parseNumber(
                    r.act_reg_cost ||
                    r.act_ot_cost ||
                    r.actual_cost ||
                    r.act_this_per_cost ||
                    0
                ),
            0
        );

    const resourceRemaining =
        taskResources.reduce(
            (sum,r)=>
                sum +
                parseNumber(
                    r.remain_cost ||
                    r.remain_qty_cost ||
                    0
                ),
            0
        );

    const budget =
        resourceBudget ||
        parseNumber(
            a.target_cost ||
            a.budgeted_cost ||
            a.at_completion_cost ||
            0
        );

    const actualCost =
        resourceActual ||
        parseNumber(
            a.act_this_per_cost ||
            a.actual_cost ||
            0
        );

    const forecastCost =
        budget ||
        actualCost ||
        resourceRemaining
            ? Math.max(
                budget,
                actualCost +
                resourceRemaining
            )
            : 0;

    const wbsId =
        String(
            a.wbs_id ||
            ""
        );

    const wbsNode =
        wbsLookup.get(
            wbsId
        );

    const calendarId =
        String(
            a.clndr_id ||
            ""
        );

    const calendar =
        calendarLookup.get(
            calendarId
        );

    const codes =
        activityCodeLookup.get(
            uid
        ) ||
        [];

    const areaCode =
        codes.find(
            code =>
                /area|zone|location|sector|work area/i
                    .test(
                        `${code.type} ${code.description}`
                    )
        );

    const activityType =
        a.task_type ||
        "";

    const milestone =
        /mile/i.test(
            activityType
        ) ||
        duration === 0;

    const constraint =
        a.cstr_type ||
        "";

    const secondConstraint =
        a.cstr_type2 ||
        "";

    return {
        uid,
        id,
        name,
        start:
            actualStart ||
            currentStart,
        finish:
            actualFinish ||
            currentFinish,
        currentStart,
        currentFinish,
        actualStart,
        actualFinish,
        baselineStart,
        baselineFinish,
        plannedStart:
            baselineStart ||
            currentStart,
        plannedFinish:
            baselineFinish ||
            currentFinish,
        duration,
        remainingDuration:remaining,
        percent,
        totalFloat,
        freeFloat,
        budget,
        actualCost,
        forecastCost,
        critical:
            String(
                a.critical_flag ||
                ""
            ).toUpperCase() === "Y" ||
            totalFloat <= 0,
        status:
            percent >= 100 ||
            actualFinish
                ? "Complete"
                : percent > 0 ||
                  actualStart
                    ? "In progress"
                    : "Not started",
        calendar:
            calendar?.name ||
            calendarId,
        calendarId,
        calendarHoursPerDay:
            calendar?.hoursPerDay ||
            8,
        activityType,
        milestone,
        constraint,
        secondConstraint,
        constraintDate:
            parseDate(
                a.cstr_date
            ),
        secondConstraintDate:
            parseDate(
                a.cstr_date2
            ),
        wbs:wbsId,
        wbsName:
            wbsNode?.name ||
            "Unassigned",
        wbsPath:
            wbsNode?.path ||
            wbsNode?.name ||
            "Unassigned",
        area:
            areaCode?.code ||
            areaCode?.description ||
            "",
        activityCodes:codes,
        suspendDate:
            parseDate(
                a.suspend_date
            ),
        resumeDate:
            parseDate(
                a.resume_date
            ),
        predecessors:[],
        successors:[],
        predecessorLinks:[],
        successorLinks:[]
    };
}

function parseMSProjectXML(fileName,text){

    const xml =
        new DOMParser()
            .parseFromString(
                text,
                "application/xml"
            );

    if(
        xml.querySelector(
            "parsererror"
        )
    ){

        throw new Error(
            "The Microsoft Project XML could not be parsed."
        );
    }

    const projectName =
        xml.querySelector(
            ":scope > Name"
        )?.textContent ||
        xml.querySelector(
            "Project > Name"
        )?.textContent ||
        fileName.replace(
            /\.xml$/i,
            ""
        );

    const projectId =
        xml.querySelector(
            "ProjectGUID"
        )?.textContent ||
        crypto.randomUUID();

    const statusDate =
        parseDate(
            xml.querySelector(
                "StatusDate"
            )?.textContent
        );

    const taskNodes =
        [
            ...xml.querySelectorAll(
                "Tasks > Task"
            )
        ];

    const acts =
        taskNodes
            .filter(
                node =>
                    node.querySelector(
                        "UID"
                    )?.textContent !==
                    "0"
            )
            .map(
                (node,index)=>
                    normaliseMSPActivity(
                        node,
                        index
                    )
            );

    const byUid =
        new Map(
            acts.map(
                activity=>[
                    String(
                        activity.uid
                    ),
                    activity
                ]
            )
        );

    const relationRows = [];

    taskNodes.forEach(
        node=>{

            const successorUid =
                String(
                    node.querySelector(
                        "UID"
                    )?.textContent ||
                    ""
                );

            node
                .querySelectorAll(
                    "PredecessorLink"
                )
                .forEach(
                    link=>{

                        const predecessorUid =
                            String(
                                link.querySelector(
                                    "PredecessorUID"
                                )?.textContent ||
                                ""
                            );

                        const predecessor =
                            byUid.get(
                                predecessorUid
                            );

                        const successor =
                            byUid.get(
                                successorUid
                            );

                        if(
                            !predecessor ||
                            !successor
                        ){
                            return;
                        }

                        relationRows.push({
                            predecessorUid,
                            successorUid,
                            predecessor:
                                predecessor.id,
                            successor:
                                successor.id,
                            type:
                                msProjectLinkType(
                                    link.querySelector(
                                        "Type"
                                    )?.textContent
                                ),
                            lag:
                                parseNumber(
                                    link.querySelector(
                                        "LinkLag"
                                    )?.textContent
                                ) / 480
                        });
                    }
                );
        }
    );

    acts.forEach(
        activity=>{

            activity.predecessors =
                relationRows
                    .filter(
                        r =>
                            r.successorUid ===
                            String(
                                activity.uid
                            )
                    )
                    .map(
                        r=>r.predecessor
                    );

            activity.successors =
                relationRows
                    .filter(
                        r =>
                            r.predecessorUid ===
                            String(
                                activity.uid
                            )
                    )
                    .map(
                        r=>r.successor
                    );

            activity.predecessorLinks =
                relationRows.filter(
                    r =>
                        r.successorUid ===
                        String(
                            activity.uid
                        )
                );

            activity.successorLinks =
                relationRows.filter(
                    r =>
                        r.predecessorUid ===
                        String(
                            activity.uid
                        )
                );
        }
    );

    const projectStart =
        parseDate(
            xml.querySelector(
                "Start"
            )?.textContent
        );

    const projectFinish =
        parseDate(
            xml.querySelector(
                "Finish"
            )?.textContent
        );

    const calendars =
        [
            ...xml.querySelectorAll(
                "Calendars > Calendar"
            )
        ].map(
            node=>({
                id:
                    node.querySelector(
                        "UID"
                    )?.textContent ||
                    "",
                name:
                    node.querySelector(
                        "Name"
                    )?.textContent ||
                    "Calendar",
                type:"MSP",
                hoursPerDay:8,
                hoursPerWeek:40
            })
        );

    return {
        fileName,
        extension:"xml",
        text,
        schedules:[{
            id:crypto.randomUUID(),
            source:"Microsoft Project",
            format:"XML",
            extension:"xml",
            name:projectName,
            projectId,
            statusDate,
            plannedStart:projectStart,
            plannedFinish:projectFinish,
            activities:acts,
            relationships:relationRows,
            wbs:buildMSPWBS(acts),
            calendars,
            rawProject:null,
            expanded:false
        }]
    };
}

function normaliseMSPActivity(
    node,
    index
){

    const uid =
        String(
            node.querySelector(
                "UID"
            )?.textContent ||
            `MSP-${index+1}`
        );

    const id =
        String(
            node.querySelector(
                "ID"
            )?.textContent ||
            uid
        );

    const name =
        node.querySelector(
            "Name"
        )?.textContent ||
        `Activity ${index+1}`;

    const currentStart =
        parseDate(
            node.querySelector(
                "Start"
            )?.textContent
        );

    const currentFinish =
        parseDate(
            node.querySelector(
                "Finish"
            )?.textContent
        );

    const actualStart =
        parseDate(
            node.querySelector(
                "ActualStart"
            )?.textContent
        );

    const actualFinish =
        parseDate(
            node.querySelector(
                "ActualFinish"
            )?.textContent
        );

    const baselineNode =
        node.querySelector(
            "Baseline"
        );

    const baselineStart =
        parseDate(
            baselineNode
                ?.querySelector(
                    "Start"
                )
                ?.textContent ||
            node.querySelector(
                "BaselineStart"
            )?.textContent
        );

    const baselineFinish =
        parseDate(
            baselineNode
                ?.querySelector(
                    "Finish"
                )
                ?.textContent ||
            node.querySelector(
                "BaselineFinish"
            )?.textContent
        );

    const duration =
        parseISO8601Duration(
            node.querySelector(
                "Duration"
            )?.textContent
        );

    const remainingDuration =
        parseISO8601Duration(
            node.querySelector(
                "RemainingDuration"
            )?.textContent
        );

    const percent =
        parseNumber(
            node.querySelector(
                "PercentComplete"
            )?.textContent
        );

    const totalFloat =
        parseISO8601Duration(
            node.querySelector(
                "TotalSlack"
            )?.textContent
        );

    const cost =
        parseNumber(
            node.querySelector(
                "Cost"
            )?.textContent
        );

    const actualCost =
        parseNumber(
            node.querySelector(
                "ActualCost"
            )?.textContent
        );

    const remainingCost =
        parseNumber(
            node.querySelector(
                "RemainingCost"
            )?.textContent
        );

    const constraint =
        node.querySelector(
            "ConstraintType"
        )?.textContent ||
        "";

    const milestone =
        node.querySelector(
            "Milestone"
        )?.textContent ===
        "1" ||
        duration === 0;

    const critical =
        node.querySelector(
            "Critical"
        )?.textContent ===
        "1" ||
        totalFloat <= 0;

    const wbs =
        node.querySelector(
            "WBS"
        )?.textContent ||
        node.querySelector(
            "OutlineNumber"
        )?.textContent ||
        "Unassigned";

    const area =
        [
            ...node.querySelectorAll(
                "ExtendedAttribute"
            )
        ]
            .map(
                attribute=>({
                    field:
                        attribute.querySelector(
                            "FieldID"
                        )?.textContent ||
                        "",
                    value:
                        attribute.querySelector(
                            "Value"
                        )?.textContent ||
                        ""
                })
            )
            .find(
                item=>
                    /area|location|zone/i
                        .test(
                            item.field
                        )
            )
            ?.value ||
        "";

    return {
        uid,
        id,
        name,
        start:
            actualStart ||
            currentStart,
        finish:
            actualFinish ||
            currentFinish,
        currentStart,
        currentFinish,
        actualStart,
        actualFinish,
        baselineStart,
        baselineFinish,
        plannedStart:
            baselineStart ||
            currentStart,
        plannedFinish:
            baselineFinish ||
            currentFinish,
        duration,
        remainingDuration:
            remainingDuration ||
            Math.max(
                0,
                duration *
                (
                    1 -
                    percent / 100
                )
            ),
        percent,
        totalFloat,
        freeFloat:0,
        budget:cost,
        actualCost,
        forecastCost:
            Math.max(
                cost || 0,
                actualCost +
                remainingCost
            ),
        critical,
        status:
            percent >= 100 ||
            actualFinish
                ? "Complete"
                : percent > 0 ||
                  actualStart
                    ? "In progress"
                    : "Not started",
        calendar:
            node.querySelector(
                "CalendarUID"
            )?.textContent ||
            "",
        calendarId:
            node.querySelector(
                "CalendarUID"
            )?.textContent ||
            "",
        calendarHoursPerDay:8,
        activityType:
            node.querySelector(
                "Type"
            )?.textContent ||
            "",
        milestone,
        constraint,
        secondConstraint:"",
        constraintDate:
            parseDate(
                node.querySelector(
                    "ConstraintDate"
                )?.textContent
            ),
        secondConstraintDate:null,
        wbs,
        wbsName:wbs,
        wbsPath:wbs,
        area,
        activityCodes:[],
        suspendDate:
            parseDate(
                node.querySelector(
                    "Stop"
                )?.textContent
            ),
        resumeDate:
            parseDate(
                node.querySelector(
                    "Resume"
                )?.textContent
            ),
        predecessors:[],
        successors:[],
        predecessorLinks:[],
        successorLinks:[]
    };
}

function buildMSPWBS(activities){

    const values =
        new Map();

    activities.forEach(
        activity=>{

            const path =
                activity.wbsPath ||
                "Unassigned";

            if(!values.has(path)){

                values.set(
                    path,
                    {
                        id:path,
                        parentId:"",
                        code:path,
                        name:path,
                        path
                    }
                );
            }
        }
    );

    return [
        ...values.values()
    ];
}

function msProjectLinkType(type){

    return ({
        "0":"FF",
        "1":"FS",
        "2":"SF",
        "3":"SS",
        "4":"SF"
    })[
        String(type)
    ] ||
    "FS";
}

function parseDate(value){

    if(!value) return null;

    const d = new Date(value);

    if(Number.isNaN(d.getTime()))
        return null;

    return d.toISOString();
}

function parseNumber(value){

    if(value === null || value === undefined)
        return 0;

    const n =
        parseFloat(
            String(value)
                .replace(/,/g,"")
        );

    return Number.isFinite(n)
        ? n
        : 0;
}

function parseDuration(value){

    if(value === null || value === undefined)
        return 0;

    return parseNumber(value) / 8;
}

function parseISO8601Duration(value){

    if(!value) return 0;

    const match =
        String(value).match(
            /P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/
        );

    if(!match)
        return 0;

    const hours =
        parseNumber(match[1]) +
        parseNumber(match[2]) / 60;

    return hours / 8;
}

function formatDate(value){

    if(!value)
        return "—";

    const d =
        new Date(value);

    if(Number.isNaN(d.getTime()))
        return "—";

    return d.toLocaleDateString(
        undefined,
        {
            year:"numeric",
            month:"short",
            day:"numeric"
        }
    );
}

function formatNumber(value){

    if(!Number.isFinite(Number(value)))
        return "—";

    return Number(value).toLocaleString(
        undefined,
        {
            maximumFractionDigits:1
        }
    );
}

function formatPercent(value){

    return `${formatNumber(value)}%`;
}

function daysBetween(a,b){

    if(!a || !b) return 0;

    return Math.round(
        (
            new Date(b) -
            new Date(a)
        ) /
        86400000
    );
}

function sleep(ms){

    return new Promise(
        resolve => setTimeout(resolve,ms)
    );
}

        function canonicaliseSchedule(schedule){
            if(!schedule || typeof schedule !== "object") return schedule;

            schedule.modelVersion = MODEL_VERSION;
            schedule.activities = Array.isArray(schedule.activities) ? schedule.activities : [];
            schedule.relationships = Array.isArray(schedule.relationships) ? schedule.relationships : [];
            schedule.wbs = Array.isArray(schedule.wbs) ? schedule.wbs : [];
            schedule.calendars = Array.isArray(schedule.calendars) ? schedule.calendars : [];
            schedule.resources = Array.isArray(schedule.resources) ? schedule.resources : [];

            for(const activity of schedule.activities){
                activity.id = String(activity.id ?? activity.uid ?? "");
                activity.uid = String(activity.uid ?? activity.id ?? "");
                activity.name = activity.name || activity.id || "Unnamed activity";
                activity.predecessors = Array.isArray(activity.predecessors) ? activity.predecessors : [];
                activity.successors = Array.isArray(activity.successors) ? activity.successors : [];
            }

            return schedule;
        }

        function canonicaliseFile(parsed){
            if(!parsed || typeof parsed !== "object") return parsed;
            parsed.modelVersion = MODEL_VERSION;
            parsed.schedules = Array.isArray(parsed.schedules)
                ? parsed.schedules.map(canonicaliseSchedule)
                : [];
            return parsed;
        }

        function parse(file,text){
            return canonicaliseFile(parseScheduleFile(file,text));
        }

        function createEmpty(name="Untitled Schedule"){
            return canonicaliseSchedule({
                id: crypto.randomUUID(),
                name,
                activities:[],
                relationships:[],
                wbs:[],
                calendars:[],
                resources:[]
            });
        }

        return {
            modelVersion: MODEL_VERSION,
            parse,
            parseXER:(fileName,text)=>canonicaliseFile(parseXER(fileName,text)),
            parseMSProjectXML:(fileName,text)=>canonicaliseFile(parseMSProjectXML(fileName,text)),
            createEmpty,
            canonicaliseSchedule,
            canonicaliseFile
        };
    })();

    const ai = (() => {
        const catalog = [
            {value:"omniroute:auto",engine:"omniroute",id:"auto",label:"OmniRoute — Auto (default)"},
            {value:"omniroute:auto/smart",engine:"omniroute",id:"auto/smart",label:"OmniRoute — Smart / quality first"},
            {value:"omniroute:auto/fast",engine:"omniroute",id:"auto/fast",label:"OmniRoute — Fastest"},
            {value:"omniroute:auto/cheap",engine:"omniroute",id:"auto/cheap",label:"OmniRoute — Lowest cost"},
            {value:"omniroute:auto/coding",engine:"omniroute",id:"auto/coding",label:"OmniRoute — Coding"},
            {value:"omniroute:auto/offline",engine:"omniroute",id:"auto/offline",label:"OmniRoute — Local/offline providers"},
            {value:"browserlite:onnx-community/Qwen2.5-0.5B-Instruct",engine:"cpu",id:"onnx-community/Qwen2.5-0.5B-Instruct",label:"Lightweight Browser AI — Qwen2.5 0.5B",ram:"about 0.8–1.5 GB"},
            {value:"cpu:onnx-community/Qwen2.5-0.5B-Instruct",engine:"cpu",id:"onnx-community/Qwen2.5-0.5B-Instruct",label:"Local CPU/WASM — Qwen2.5 0.5B",ram:"about 0.8–1.5 GB"},
            {value:"cpu:onnx-community/Llama-3.2-1B-Instruct",engine:"cpu",id:"onnx-community/Llama-3.2-1B-Instruct",label:"Local CPU/WASM — Llama 3.2 1B",ram:"about 1.2–2.2 GB"},
            {value:"webllmio:low",engine:"mlc",id:"Qwen2.5-1.5B-Instruct-q4f16_1-MLC",label:"Local WebGPU — Qwen2.5 1.5B",ram:"about 1.5–3 GB"},
            {value:"webllmio:medium",engine:"mlc",id:"Qwen2.5-3B-Instruct-q4f16_1-MLC",label:"Local WebGPU — Qwen2.5 3B",ram:"about 3–5 GB"},
            {value:"webllmio:high",engine:"mlc",id:"Qwen3-8B-q4f16_1-MLC",label:"Local WebGPU — Qwen3 8B",ram:"about 7–12 GB"},
            {value:"mlc:Llama-3.2-1B-Instruct-q4f16_1-MLC",engine:"mlc",id:"Llama-3.2-1B-Instruct-q4f16_1-MLC",label:"MLC — Llama 3.2 1B",ram:"about 1.5–3 GB"},
            {value:"mlc:Llama-3.2-3B-Instruct-q4f16_1-MLC",engine:"mlc",id:"Llama-3.2-3B-Instruct-q4f16_1-MLC",label:"MLC — Llama 3.2 3B",ram:"about 3–5 GB"},
            {value:"mlc:Phi-3.5-mini-instruct-q4f16_1-MLC",engine:"mlc",id:"Phi-3.5-mini-instruct-q4f16_1-MLC",label:"MLC — Phi 3.5 Mini",ram:"about 3–6 GB"},
            {value:"mlc:Llama-3.1-8B-Instruct-q4f16_1-MLC",engine:"mlc",id:"Llama-3.1-8B-Instruct-q4f16_1-MLC",label:"MLC — Llama 3.1 8B",ram:"about 7–12 GB"},
            {value:"proprietary:placeholder",engine:"placeholder",id:null,label:"Proprietary Schedule AI Toolkit",disabled:true},
            {value:"ollama:placeholder",engine:"placeholder",id:null,label:"Ollama — local installation",disabled:true}
        ];

        let currentValue = null;
        let currentEngine = null;
        let currentLabel = "AI idle";
        let runtime = null;
        let loadingPromise = null;

        function normaliseBaseUrl(value){
            let clean=String(value||"").trim().replace(/\/+$/,"");
            if(!clean) clean="http://localhost:20128/v1";
            if(!/\/v1$/i.test(clean)) clean+="/v1";
            return clean;
        }

        function defaultBaseUrl(){
            try{
                return normaliseBaseUrl(
                    localStorage.getItem("projectControlsOmniRouteBaseUrl") ||
                    "http://localhost:20128/v1"
                );
            }catch(_){
                return "http://localhost:20128/v1";
            }
        }

        function endpointKey(){
            try{
                return sessionStorage.getItem("projectControlsOmniRouteEndpointKey") || "";
            }catch(_){
                return "";
            }
        }

        function config(){
            return {
                baseUrl:defaultBaseUrl(),
                endpointKeyConfigured:!!endpointKey()
            };
        }

        function configure({baseUrl,endpointKey:nextKey}={}){
            if(typeof baseUrl==="string" && baseUrl.trim()){
                const clean=normaliseBaseUrl(baseUrl);
                try{localStorage.setItem("projectControlsOmniRouteBaseUrl",clean)}catch(_){}
            }

            if(typeof nextKey==="string"){
                try{
                    if(nextKey.trim()){
                        sessionStorage.setItem(
                            "projectControlsOmniRouteEndpointKey",
                            nextKey.trim()
                        );
                    }else{
                        sessionStorage.removeItem(
                            "projectControlsOmniRouteEndpointKey"
                        );
                    }
                }catch(_){}
            }

            return config();
        }

        function omniHeaders(){
            const headers={
                "Content-Type":"application/json"
            };
            const key=endpointKey();
            if(key){
                headers.Authorization=`Bearer ${key}`;
            }
            return headers;
        }

        function isLoopbackUrl(url){
            try{
                const parsed=new URL(url,location.href);
                return [
                    "localhost",
                    "127.0.0.1",
                    "::1"
                ].includes(parsed.hostname);
            }catch(_){
                return false;
            }
        }

        function loopbackAlternative(url){
            try{
                const parsed=new URL(url,location.href);
                if(parsed.hostname==="localhost"){
                    parsed.hostname="127.0.0.1";
                    return parsed.toString().replace(/\/$/,"");
                }
                if(parsed.hostname==="127.0.0.1"){
                    parsed.hostname="localhost";
                    return parsed.toString().replace(/\/$/,"");
                }
            }catch(_){}
            return null;
        }

        async function omniFetch(url,options={}){
            const candidates=[url];
            const alternate=loopbackAlternative(url);
            if(alternate && alternate!==url){
                candidates.push(alternate);
            }

            let lastError=null;

            for(const candidate of candidates){
                const controller=new AbortController();
                const timeout=setTimeout(
                    ()=>controller.abort(),
                    18000
                );

                try{
                    const requestOptions={
                        ...options,
                        mode:"cors",
                        cache:"no-store",
                        signal:controller.signal
                    };

                    if(isLoopbackUrl(candidate)){
                        requestOptions.targetAddressSpace="loopback";
                    }

                    return await fetch(
                        candidate,
                        requestOptions
                    );

                }catch(error){
                    lastError=error;
                }finally{
                    clearTimeout(timeout);
                }
            }

            const baseUrl=config().baseUrl;
            const local=isLoopbackUrl(baseUrl);
            const securePage=location.protocol==="https:";

            if(lastError?.name==="AbortError"){
                throw new Error(
                    `OmniRoute did not respond at ${baseUrl} within 18 seconds. Confirm OmniRoute is running on port 20128.`
                );
            }

            if(local && securePage){
                throw new Error(
                    `The browser could not reach local OmniRoute at ${baseUrl}. Allow local/loopback network access for this site if your browser prompts for it. If no prompt appears, open OmniRoute at http://localhost:20128 in another tab to confirm it is running, then retry.`
                );
            }

            throw new Error(
                `Could not reach OmniRoute at ${baseUrl}. Confirm the service is running and that CORS allows this website origin.`
            );
        }

        async function parseOmniResponse(response){
            const text=await response.text();
            let data={};

            try{
                data=text
                    ? JSON.parse(text)
                    : {};
            }catch(_){
                data={
                    error:{
                        message:
                            text ||
                            `HTTP ${response.status}`
                    }
                };
            }

            if(response.status===401 || response.status===403){
                const detail=
                    data?.error?.message ||
                    data?.message ||
                    `HTTP ${response.status}`;

                throw new Error(
                    `OmniRoute is reachable, but its /v1 endpoint rejected the request (${detail}). This OmniRoute installation requires endpoint authentication. Either enter the optional Endpoint Key in AI Settings, or configure OmniRoute for keyless local-only access.`
                );
            }

            if(!response.ok){
                const message=
                    data?.error?.message ||
                    data?.message ||
                    `HTTP ${response.status}`;

                throw new Error(
                    `OmniRoute request failed: ${message}`
                );
            }

            return data;
        }

        function model(value){
            const found=catalog.find(item=>item.value===value && !item.disabled);
            return found || catalog.find(item=>item.value==="omniroute:auto");
        }

        async function release(){
            const old = runtime;
            runtime = null;
            currentValue = null;
            currentEngine = null;
            currentLabel = "AI idle";
            try{if(old?.dispose) await old.dispose()}catch(_){}
            try{if(old?.unload) await old.unload()}catch(_){}
        }

        function requireLocalConsent(entry){
            if(!["cpu","mlc"].includes(entry.engine)) return;
            const key=`projectControlsLocalAIConsent:${entry.value}`;
            try{if(sessionStorage.getItem(key)==="1") return}catch(_){}
            const where=entry.engine==="mlc"?"GPU memory and system RAM":"system RAM";
            const accepted=window.confirm(`${entry.label} runs locally in this browser. It can use significant ${where} (${entry.ram||"several GB"}) and may slow the overall application, other browser tabs, and your computer.\n\nContinue loading this model?`);
            if(!accepted) throw new Error("Local AI loading was cancelled.");
            try{sessionStorage.setItem(key,"1")}catch(_){}
        }

        async function load(value){
            const entry=model(value);
            if(currentValue===entry.value && runtime) return status();
            requireLocalConsent(entry);
            await release();

            if(entry.engine==="omniroute"){
                runtime={type:"omniroute",model:entry.id};
            }else if(entry.engine==="cpu"){
                const transformers = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1");
                runtime = await transformers.pipeline("text-generation",entry.id,{device:"wasm",dtype:"q4"});
            }else if(entry.engine==="mlc"){
                if(!navigator.gpu) throw new Error("WebGPU is not available in this browser/device.");
                const webllm = await import("https://esm.run/@mlc-ai/web-llm");
                runtime = await webllm.CreateMLCEngine(entry.id,{});
            }else{
                throw new Error("This AI option is not available yet.");
            }

            currentValue=entry.value;
            currentEngine=entry.engine;
            currentLabel=entry.label;
            try{localStorage.setItem("projectControlsSharedAIModel",entry.value)}catch(_){}
            return status();
        }

        async function ensure(value){
            const requested=value || (()=>{try{return localStorage.getItem("projectControlsSharedAIModel")}catch(_){return null}})() || "omniroute:auto";
            const entry=model(requested);
            if(currentValue===entry.value && runtime) return status();
            if(loadingPromise) return await loadingPromise;
            loadingPromise=load(entry.value).finally(()=>loadingPromise=null);
            return await loadingPromise;
        }

        function extractGeneratedText(output){
            let generated = output?.[0]?.generated_text ?? output?.generated_text ?? "";
            if(Array.isArray(generated)){
                const last=[...generated].reverse().find(item=>item?.role==="assistant");
                generated=last?.content || "";
            }
            if(typeof generated!=="string") generated=String(generated||"");
            return generated.trim();
        }

        async function runOmniRoute(messages,{temperature,max_tokens,onToken}){
            const {baseUrl}=config();

            const response=await omniFetch(
                `${baseUrl}/chat/completions`,
                {
                    method:"POST",
                    headers:omniHeaders(),
                    body:JSON.stringify({
                        model:runtime?.model || "auto",
                        messages,
                        temperature,
                        max_tokens,
                        stream:false
                    })
                }
            );

            const data=await parseOmniResponse(response);
            const content=
                data?.choices?.[0]?.message?.content ??
                data?.choices?.[0]?.text ??
                "";

            if(onToken && content){
                onToken(String(content));
            }

            if(!String(content||"").trim()){
                throw new Error(
                    "OmniRoute returned a successful response but no assistant text. Check the selected provider and routing configuration in OmniRoute."
                );
            }

            return {
                choices:[
                    {
                        message:{
                            content:String(content)
                        }
                    }
                ]
            };
        }

        async function runMLC(messages,{temperature,max_tokens,stream,onToken}){
            if(stream){
                const response=await runtime.chat.completions.create({messages,temperature,max_tokens,stream:true});
                let content="";
                if(response && typeof response[Symbol.asyncIterator]==="function"){
                    for await(const chunk of response){
                        const delta=chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || "";
                        if(delta){
                            content+=delta;
                            if(onToken) onToken(delta);
                        }
                    }
                    return {choices:[{message:{content}}]};
                }
            }
            const response=await runtime.chat.completions.create({messages,temperature,max_tokens,stream:false});
            const content=response?.choices?.[0]?.message?.content || "";
            if(onToken && content) onToken(content);
            return {choices:[{message:{content:String(content||"")}}]};
        }

        async function run(messages,{temperature=.2,max_tokens=1000,stream=false,onToken=null}={}){
            await ensure(currentValue || "omniroute:auto");

            if(currentEngine==="omniroute") return await runOmniRoute(messages,{temperature,max_tokens,onToken});

            if(currentEngine==="cpu"){
                const output=await runtime(messages,{max_new_tokens:max_tokens,temperature,do_sample:temperature>0,return_full_text:false});
                const content=extractGeneratedText(output);
                if(onToken && content) onToken(content);
                return {choices:[{message:{content}}]};
            }

            if(currentEngine==="mlc") return await runMLC(messages,{temperature,max_tokens,stream,onToken});

            throw new Error("No AI engine is available.");
        }

        async function testConnection(){
            const savedValue=currentValue;
            const savedRuntime=runtime;
            const savedEngine=currentEngine;
            const savedLabel=currentLabel;
            const {baseUrl}=config();

            try{
                const modelsResponse=
                    await omniFetch(
                        `${baseUrl}/models`,
                        {
                            method:"GET",
                            headers:omniHeaders()
                        }
                    );

                const modelsData=
                    await parseOmniResponse(
                        modelsResponse
                    );

                const modelCount=
                    Array.isArray(modelsData?.data)
                        ? modelsData.data.length
                        : null;

                runtime={
                    type:"omniroute",
                    model:"auto/fast"
                };

                currentValue=
                    "omniroute:auto/fast";

                currentEngine=
                    "omniroute";

                currentLabel=
                    "OmniRoute — Fastest";

                const result=
                    await runOmniRoute(
                        [
                            {
                                role:"user",
                                content:"Reply with exactly OK"
                            }
                        ],
                        {
                            temperature:0,
                            max_tokens:8,
                            onToken:null
                        }
                    );

                return {
                    ok:true,
                    content:
                        result?.choices?.[0]?.message?.content ||
                        "OK",
                    modelCount,
                    baseUrl,
                    endpointKeyConfigured:
                        !!endpointKey()
                };

            }finally{
                currentValue=savedValue;
                runtime=savedRuntime;
                currentEngine=savedEngine;
                currentLabel=savedLabel;
            }
        }

        function status(){
            return {ready:!!runtime,value:currentValue,engine:currentEngine || "shared",label:currentLabel,loading:!!loadingPromise,config:config()};
        }

        return {catalog,ensure,run,release,status,config,configure,testConnection};
    })();

    const risk = (() => {

        const WORKER_SOURCE = String.raw`
"use strict";

const DAY_MS = 86400000;

function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
}

function seededRandomFactory(seed){
    let value=(Number(seed)||12345)>>>0;
    return function(){
        value+=0x6D2B79F5;
        let t=value;
        t=Math.imul(t^t>>>15,t|1);
        t^=t+Math.imul(t^t>>>7,t|61);
        return ((t^t>>>14)>>>0)/4294967296;
    };
}

function triangularSample(min,mode,max,u){
    if(!Number.isFinite(min)||!Number.isFinite(mode)||!Number.isFinite(max)||max<=min){
        return Number.isFinite(mode)?mode:0;
    }
    const f=(mode-min)/(max-min);
    if(u<f){
        return min+Math.sqrt(u*(max-min)*(mode-min));
    }
    return max-Math.sqrt((1-u)*(max-min)*(max-mode));
}

function toDay(value){
    if(value===null||value===undefined||value==="") return NaN;
    const time=typeof value==="number"?value:Date.parse(value);
    return Number.isFinite(time)?time/DAY_MS:NaN;
}

function dayOfWeek(day){
    const whole=Math.floor(day);
    return ((whole+4)%7+7)%7;
}

function isWorkingDow(dow,daysPerWeek){
    if(daysPerWeek>=7) return true;
    if(daysPerWeek>=6) return dow!==0;
    return dow>=1 && dow<=5;
}

function moveToWorkingDay(day,daysPerWeek,direction){
    if(daysPerWeek>=7) return day;
    const frac=day-Math.floor(day);
    let whole=Math.floor(day);
    let guard=0;
    while(!isWorkingDow(dayOfWeek(whole),daysPerWeek) && guard++<8){
        whole+=direction;
    }
    return whole+frac;
}

function addWorkingDays(start,amount,daysPerWeek){
    if(!Number.isFinite(start)) return NaN;
    if(!Number.isFinite(amount)||Math.abs(amount)<1e-9) return start;
    if(daysPerWeek>=7) return start+amount;

    const sign=amount>=0?1:-1;
    let remaining=Math.abs(amount);
    let day=moveToWorkingDay(start,daysPerWeek,sign);

    const whole=Math.floor(remaining);
    const fraction=remaining-whole;

    if(whole>0){
        const weeks=Math.floor(whole/daysPerWeek);
        day+=weeks*7*sign;
        let rem=whole%daysPerWeek;
        while(rem>0){
            day+=sign;
            if(isWorkingDow(dayOfWeek(day),daysPerWeek)) rem--;
        }
    }

    if(fraction>0){
        day+=fraction*sign;
    }

    return day;
}

function calendarDaysPerWeek(activity){
    const hpDay=Number(activity.calendarHoursPerDay)||8;
    const hpWeek=Number(activity.calendarHoursPerWeek)||40;
    const estimate=hpDay>0?hpWeek/hpDay:5;
    if(estimate>=6.5) return 7;
    if(estimate>=5.5) return 6;
    return 5;
}

function normalizeRelationType(type){
    const t=String(type||"FS").toUpperCase().replace(/^PR_/,"");
    return ["FS","SS","FF","SF"].includes(t)?t:"FS";
}

function prepare(payload){
    const activities=(payload.activities||[]).map((activity,index)=>{
        const duration=Math.max(0,Number(activity.remainingDuration ?? activity.duration ?? 0)||0);
        const start=toDay(activity.actualStart||activity.currentStart||activity.start);
        const finish=toDay(activity.actualFinish||activity.currentFinish||activity.finish);
        const complete=activity.complete===true || Number(activity.percent)>=100 || !!activity.actualFinish;
        const inProgress=!complete && (!!activity.actualStart || Number(activity.percent)>0);
        return {
            index,
            uid:String(activity.uid??activity.id??index),
            id:String(activity.id??activity.uid??index),
            name:String(activity.name||activity.id||activity.uid||("Activity "+(index+1))),
            duration,
            percent:Number(activity.percent)||0,
            totalFloat:Number.isFinite(Number(activity.totalFloat))?Number(activity.totalFloat):999999,
            critical:!!activity.critical,
            milestone:!!activity.milestone || duration===0,
            complete,
            inProgress,
            fixedStart:start,
            fixedFinish:finish,
            daysPerWeek:calendarDaysPerWeek(activity)
        };
    });

    const byUid=new Map();
    const byId=new Map();
    activities.forEach(a=>{
        byUid.set(a.uid,a.index);
        byId.set(a.id,a.index);
    });

    const relations=[];
    for(const rel of payload.relationships||[]){
        let pred=byUid.get(String(rel.predecessorUid??""));
        let succ=byUid.get(String(rel.successorUid??""));
        if(pred===undefined) pred=byId.get(String(rel.predecessor??""));
        if(succ===undefined) succ=byId.get(String(rel.successor??""));
        if(pred===undefined||succ===undefined||pred===succ) continue;
        relations.push({
            pred,
            succ,
            type:normalizeRelationType(rel.type),
            lag:Number(rel.lag)||0
        });
    }

    const incoming=Array.from({length:activities.length},()=>[]);
    const outgoing=Array.from({length:activities.length},()=>[]);
    const indegree=new Int32Array(activities.length);

    relations.forEach((rel,idx)=>{
        incoming[rel.succ].push(idx);
        outgoing[rel.pred].push(idx);
        indegree[rel.succ]++;
    });

    const queue=[];
    for(let i=0;i<activities.length;i++){
        if(indegree[i]===0) queue.push(i);
    }

    const order=[];
    let q=0;
    while(q<queue.length){
        const node=queue[q++];
        order.push(node);
        for(const relIndex of outgoing[node]){
            const succ=relations[relIndex].succ;
            indegree[succ]--;
            if(indegree[succ]===0) queue.push(succ);
        }
    }

    const cycleCount=activities.length-order.length;
    if(cycleCount){
        const inOrder=new Uint8Array(activities.length);
        order.forEach(i=>inOrder[i]=1);

        for(let i=0;i<activities.length;i++){
            if(!inOrder[i]) order.push(i);
        }
    }

    return {activities,relations,incoming,outgoing,order,cycleCount};
}

function simulate(payload,settings){
    const prepared=prepare(payload);
    const {activities,relations,incoming,order,cycleCount}=prepared;
    const n=activities.length;

    const statusDate=toDay(payload.statusDate);
    let deterministicStart=Number.isFinite(statusDate)?statusDate:Infinity;
    let deterministicFinish=-Infinity;

    for(const a of activities){
        if(Number.isFinite(a.fixedStart)) deterministicStart=Math.min(deterministicStart,a.fixedStart);
        if(Number.isFinite(a.fixedFinish)) deterministicFinish=Math.max(deterministicFinish,a.fixedFinish);
    }
    if(!Number.isFinite(deterministicStart)) deterministicStart=Date.now()/DAY_MS;
    if(!Number.isFinite(deterministicFinish)) deterministicFinish=deterministicStart;

    const riskMask=new Uint8Array(n);
    let riskCount=0;
    for(const a of activities){
        if(a.complete || a.duration<=0) continue;
        const eligible=settings.scope==="all" || a.critical || a.totalFloat<=settings.nearCriticalFloat;
        if(eligible){
            riskMask[a.index]=1;
            riskCount++;
        }
    }

    if(!riskCount){
        for(const a of activities){
            if(!a.complete && a.duration>0){
                riskMask[a.index]=1;
                riskCount++;
            }
        }
    }

    const iterations=clamp(Math.trunc(Number(settings.iterations)||5000),500,50000);
    const optimistic=clamp(Number(settings.optimisticPct)||80,20,100)/100;
    const likely=clamp(Number(settings.mostLikelyPct)||100,optimistic*100,160)/100;
    const pessimistic=clamp(Number(settings.pessimisticPct)||140,likely*100,300)/100;
    const correlation=clamp(Number(settings.correlation)||0,0,.95);
    const random=seededRandomFactory(settings.seed);

    const starts=new Float64Array(n);
    const finishes=new Float64Array(n);
    const sampled=new Float64Array(n);
    const driverPred=new Int32Array(n);
    const results=new Float64Array(iterations);

    const criticalHits=new Uint32Array(n);
    const sumX=new Float64Array(n);
    const sumX2=new Float64Array(n);
    const sumXY=new Float64Array(n);
    let sumY=0;
    let sumY2=0;

    const terminalCandidates=[];
    const hasOutgoing=new Uint8Array(n);
    relations.forEach(r=>hasOutgoing[r.pred]=1);
    for(let i=0;i<n;i++){
        if(!hasOutgoing[i]) terminalCandidates.push(i);
    }

    const progressEvery=Math.max(1,Math.floor(iterations/100));
    let lastProgress=0;

    for(let iteration=0;iteration<iterations;iteration++){
        const commonU=random();
        driverPred.fill(-1);

        for(let i=0;i<n;i++){
            const a=activities[i];
            if(a.complete){
                sampled[i]=0;
                continue;
            }
            if(!riskMask[i]){
                sampled[i]=a.duration;
                continue;
            }
            const independentU=random();
            const u=clamp(correlation*commonU+(1-correlation)*independentU,0.000001,0.999999);
            const d=a.duration;
            sampled[i]=triangularSample(d*optimistic,d*likely,d*pessimistic,u);
        }

        for(const idx of order){
            const a=activities[idx];

            if(a.complete){
                const s=Number.isFinite(a.fixedStart)?a.fixedStart:
                    (Number.isFinite(a.fixedFinish)?a.fixedFinish:deterministicStart);
                const f=Number.isFinite(a.fixedFinish)?a.fixedFinish:s;
                starts[idx]=s;
                finishes[idx]=f;
                continue;
            }

            const duration=sampled[idx];
            let startAnchor=Number.isFinite(statusDate)?statusDate:deterministicStart;

            if(a.inProgress){

                startAnchor=Math.max(startAnchor,Number.isFinite(a.fixedStart)?a.fixedStart:startAnchor);
            }else if(Number.isFinite(a.fixedStart)){

                startAnchor=Math.max(startAnchor,a.fixedStart);
            }

            let earliestStart=startAnchor;
            let controllingPred=-1;

            for(const relIndex of incoming[idx]){
                const rel=relations[relIndex];
                const p=rel.pred;
                const pred=activities[p];
                const lagDays=rel.lag;
                let candidate;

                switch(rel.type){
                    case "SS":
                        candidate=addWorkingDays(starts[p],lagDays,a.daysPerWeek);
                        break;
                    case "FF":{
                        const requiredFinish=addWorkingDays(finishes[p],lagDays,a.daysPerWeek);
                        candidate=addWorkingDays(requiredFinish,-duration,a.daysPerWeek);
                        break;
                    }
                    case "SF":{
                        const requiredFinish=addWorkingDays(starts[p],lagDays,a.daysPerWeek);
                        candidate=addWorkingDays(requiredFinish,-duration,a.daysPerWeek);
                        break;
                    }
                    case "FS":
                    default:
                        candidate=addWorkingDays(finishes[p],lagDays,a.daysPerWeek);
                        break;
                }

                if(Number.isFinite(candidate) && candidate>earliestStart+1e-9){
                    earliestStart=candidate;
                    controllingPred=p;
                }
            }

            starts[idx]=earliestStart;
            finishes[idx]=addWorkingDays(earliestStart,duration,a.daysPerWeek);
            driverPred[idx]=controllingPred;
        }

        let projectFinish=-Infinity;
        let finishActivity=-1;
        const candidates=terminalCandidates.length?terminalCandidates:order;
        for(const idx of candidates){
            const f=finishes[idx];
            if(Number.isFinite(f) && f>projectFinish){
                projectFinish=f;
                finishActivity=idx;
            }
        }

        if(!Number.isFinite(projectFinish)) projectFinish=deterministicFinish;
        results[iteration]=projectFinish;
        sumY+=projectFinish;
        sumY2+=projectFinish*projectFinish;

        let cursor=finishActivity;
        let guard=0;
        while(cursor>=0 && guard++<n){
            criticalHits[cursor]++;
            cursor=driverPred[cursor];
        }

        for(let i=0;i<n;i++){
            if(!riskMask[i]) continue;
            const x=sampled[i];
            sumX[i]+=x;
            sumX2[i]+=x*x;
            sumXY[i]+=x*projectFinish;
        }

        if(iteration===iterations-1 || iteration-lastProgress>=progressEvery){
            lastProgress=iteration;
            postMessage({
                type:"progress",
                completed:iteration+1,
                total:iterations,
                percent:Math.round((iteration+1)*100/iterations)
            });
        }
    }

    const sorted=Array.from(results).sort((a,b)=>a-b);
    function percentile(p){
        if(!sorted.length) return NaN;
        const index=(sorted.length-1)*p;
        const lo=Math.floor(index);
        const hi=Math.ceil(index);
        if(lo===hi) return sorted[lo];
        const weight=index-lo;
        return sorted[lo]*(1-weight)+sorted[hi]*weight;
    }

    const meanY=sumY/iterations;
    const varY=Math.max(0,sumY2/iterations-meanY*meanY);
    const sdY=Math.sqrt(varY);

    const riskRows=[];
    for(let i=0;i<n;i++){
        if(!riskMask[i]) continue;
        const meanX=sumX[i]/iterations;
        const varX=Math.max(0,sumX2[i]/iterations-meanX*meanX);
        const cov=sumXY[i]/iterations-meanX*meanY;
        const sensitivity=(varX>1e-12 && varY>1e-12)?cov/Math.sqrt(varX*varY):0;
        const criticality=criticalHits[i]/iterations;
        riskRows.push({
            id:activities[i].id,
            name:activities[i].name,
            criticality,
            sensitivity,
            baseDuration:activities[i].duration,
            score:Math.max(0,criticality)*0.65+Math.max(0,sensitivity)*0.35
        });
    }
    riskRows.sort((a,b)=>b.score-a.score);

    return {
        iterations,
        activityCount:n,
        relationCount:relations.length,
        riskActivityCount:riskCount,
        cycleCount,
        deterministicFinish,
        probabilities:{
            p10:percentile(.10),
            p20:percentile(.20),
            p50:percentile(.50),
            p80:percentile(.80),
            p90:percentile(.90),
            p95:percentile(.95)
        },
        meanFinish:meanY,
        standardDeviationDays:sdY,
        riskRows:riskRows.slice(0,100)
    };
}

self.onmessage=function(event){
    try{
        const {payload,settings}=event.data||{};
        const result=simulate(payload||{},settings||{});
        postMessage({type:"result",result});
    }catch(error){
        postMessage({
            type:"error",
            message:error && error.message ? error.message : String(error)
        });
    }
};
`;

        let activeWorker = null;

        function serialiseSchedule(schedule){
            const calendars = new Map(
                (schedule?.calendars || []).map(calendar => [
                    String(calendar.id || ""),
                    calendar
                ])
            );

            const activities = (schedule?.activities || []).map(activity => {
                const calendar = calendars.get(String(activity.calendarId || "")) || {};
                return {
                    uid: activity.uid,
                    id: activity.id,
                    name: activity.name,
                    currentStart: activity.currentStart || activity.start,
                    currentFinish: activity.currentFinish || activity.finish,
                    actualStart: activity.actualStart,
                    actualFinish: activity.actualFinish,
                    duration: activity.duration,
                    remainingDuration: activity.remainingDuration,
                    percent: activity.percent,
                    totalFloat: activity.totalFloat,
                    critical: activity.critical,
                    milestone: activity.milestone,
                    calendarHoursPerDay:
                        Number(activity.calendarHoursPerDay) ||
                        Number(calendar.hoursPerDay) ||
                        8,
                    calendarHoursPerWeek:
                        Number(calendar.hoursPerWeek) ||
                        40
                };
            });

            return {
                statusDate:
                    schedule?.statusDate ||
                    schedule?.dataDate ||
                    schedule?.plannedStart ||
                    null,
                activities,
                relationships: (schedule?.relationships || []).map(rel => ({
                    predecessorUid: rel.predecessorUid,
                    successorUid: rel.successorUid,
                    predecessor: rel.predecessor,
                    successor: rel.successor,
                    type: rel.type,
                    lag: Number(rel.lag) || 0
                }))
            };
        }

        async function runMonteCarlo(schedule, settings = {}, onProgress = null){
            if(!schedule){
                throw new Error("No schedule was supplied to the risk engine.");
            }

            if(activeWorker){
                try{ activeWorker.terminate(); }catch(_){}
                activeWorker = null;
            }

            const blob = new Blob([WORKER_SOURCE], {type:"text/javascript"});
            const url = URL.createObjectURL(blob);
            const worker = new Worker(url);
            activeWorker = worker;

            return await new Promise((resolve, reject) => {
                let settled = false;

                const cleanup = () => {
                    if(settled) return;
                    settled = true;
                    try{ worker.terminate(); }catch(_){}
                    URL.revokeObjectURL(url);
                    if(activeWorker === worker) activeWorker = null;
                };

                worker.onmessage = event => {
                    const message = event.data || {};

                    if(message.type === "progress"){
                        if(typeof onProgress === "function"){
                            try{ onProgress(message); }catch(_){}
                        }
                        return;
                    }

                    if(message.type === "result"){
                        const result = message.result;
                        cleanup();
                        resolve(result);
                        return;
                    }

                    if(message.type === "error"){
                        const error = new Error(message.message || "Monte Carlo worker failed.");
                        cleanup();
                        reject(error);
                    }
                };

                worker.onerror = event => {
                    const error = new Error(event.message || "Monte Carlo worker failed.");
                    cleanup();
                    reject(error);
                };

                worker.postMessage({
                    payload: serialiseSchedule(schedule),
                    settings
                });
            });
        }

        function cancelMonteCarlo(){
            if(activeWorker){
                try{ activeWorker.terminate(); }catch(_){}
                activeWorker = null;
            }
        }

        return {
            runMonteCarlo,
            cancelMonteCarlo
        };
    })();

    return Object.freeze({
        version: VERSION,
        cssVersion:"1.0",
        documents,
        schedule,
        ai,
        risk
    });
})();

window.ProjectControlsCore = ProjectControlsCore;
