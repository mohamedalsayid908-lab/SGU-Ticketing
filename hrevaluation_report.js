//==================================================
// إعداد الاتصال بـ Supabase
//==================================================

const SUPABASE_URL =
"https://cqmhpvaaaduqbhjtyrgk.supabase.co/rest/v1/";

const SUPABASE_KEY =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhwdmFhYWR1cWJoanR5cmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA3OTUsImV4cCI6MjA5NDE4Njc5NX0.eqZ69jTSRFvPhjSVx2KZe9-3LSw0cw8uAQ6D06ZkQFg";

const HEADERS = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY
};


 let user = JSON.parse(sessionStorage.getItem("user"));

if (!user || user.role !== "admin_hr") {

    logout();

}

let allTickets = [];

function logout() {

    sessionStorage.clear();

    window.location.replace("index.html");

}
//==================================================
// تنفيذ طلب REST
//==================================================

async function fetchAPI(url){

    let res = await fetch(url,{
        headers:HEADERS
    });

    return await res.json();

}

//==================================================
//==================================================
// تحميل موظفي شؤون العاملين
//==================================================

async function loadEngineers(){

    let employees = await fetchAPI(

        SUPABASE_URL +
        "users?role=eq.hr&order=name"

    );

    let html = `
        <option value="">
            جميع موظفي شؤون العاملين
        </option>
    `;

    for(let e of employees){

        html += `
            <option value="${e.id}">
                ${e.name}
            </option>
        `;

    }

    engineerFilter.innerHTML = html;

}

//==================================================
// تحميل الموظفين
//==================================================

async function loadEmployees(){

    let employees = await fetchAPI(

        SUPABASE_URL +
        "users?role=eq.employee&order=name"

    );

    let html = `
        <option value="">
            جميع الموظفين
        </option>
    `;

    for(let e of employees){

        html += `
            <option value="${e.id}">
                ${e.name}
            </option>
        `;

    }

    employeeFilter.innerHTML = html;

}

//==================================================
// تحميل الصفحة
//==================================================

window.onload = async ()=>{

    await loadEngineers();

    await loadEmployees();

};

//==================================================
//==================================================
// جلب بيانات التقرير
//==================================================

async function loadReportData(){

    let from = fromDate.value;
    let to = toDate.value;

    let hrEmployee = engineerFilter.value;
    let employee = employeeFilter.value;
    let faculty = facultyFilter.value;

    //------------------------------------------------
    // بناء رابط التذاكر
    //------------------------------------------------

    let url =
        SUPABASE_URL +

        "tickets?" +

        "select=*,\
creator:users!tickets_created_by_fkey(id,name,phone,faculty),\
engineer:users!tickets_assigned_to_fkey(id,name,phone,faculty,role)" +

        "&order=created_at.desc";

    let filters = [];

    if(from){

        filters.push(

            "created_at=gte." + from

        );

    }

    if(to){

        filters.push(

            "created_at=lte." + to + "T23:59:59"

        );

    }

    if(hrEmployee){

        filters.push(

            "assigned_to=eq." + hrEmployee

        );

    }

    if(employee){

        filters.push(

            "created_by=eq." + employee

        );

    }

    if(faculty){

        filters.push(

            "faculty=eq." + faculty

        );

    }

    if(filters.length){

        url += "&" + filters.join("&");

    }

    //------------------------------------------------
    // تحميل البيانات
    //------------------------------------------------

    let tickets = await fetchAPI(url);

    //------------------------------------------------
    // الحلول
    //------------------------------------------------

    let solutions = await fetchAPI(

        SUPABASE_URL +

        "ticket_solution?" +

        "select=ticket_id,solution_text,created_at"

    );

    //------------------------------------------------
    // التقييمات
    //------------------------------------------------

    let ratings = await fetchAPI(

        SUPABASE_URL +

        "ratings"

    );

    //------------------------------------------------
    // تحميل موظفي HR
    //------------------------------------------------

    let engineers = await fetchAPI(

        SUPABASE_URL +

        "users?role=eq.hr&order=name"

    );

    //------------------------------------------------
    // استخراج معرفات موظفي HR
    //------------------------------------------------

    let hrIds = engineers.map(e => e.id);

    //------------------------------------------------
    // تصفية التذاكر
    //------------------------------------------------

    tickets = tickets.filter(

        t => hrIds.includes(t.assigned_to)

    );

    //------------------------------------------------
    // دمج البيانات
    //------------------------------------------------

    for(let ticket of tickets){

        ticket.solution = solutions.find(

            s => s.ticket_id == ticket.id

        );

        ticket.rating = ratings.find(

            r => r.ticket_id == ticket.id

        );

    }

    return {

        tickets,
        engineers

    };

}


//==================================================
// ترتيب الحالات
//==================================================

function sortTickets(list){

    const order={
        open:1,
        in_progress:2,
        resolved:3,
        closed:4
    };

    return list.sort((a,b)=>{

        return order[a.status]-order[b.status];

    });

}

//==================================================
// حساب الفرق بالدقائق
//==================================================

function getMinutes(start,end){

    if(!start || !end)
        return null;

    let d1=new Date(start);
    let d2=new Date(end);

    return Math.round(

        (d2-d1)/60000

    );

}

//==================================================
// تحويل الدقائق إلى نص
//==================================================

function formatMinutes(minutes){

    if(minutes==null)
        return "-";

    let days=Math.floor(minutes/1440);

    minutes%=1440;

    let hours=Math.floor(minutes/60);

    let mins=minutes%60;

    let txt="";

    if(days>0)
        txt+=days+" يوم ";

    if(hours>0)
        txt+=hours+" ساعة ";

    if(mins>0 || txt=="")
        txt+=mins+" دقيقة";

    return txt;

}

//==================================================
// تقييم سرعة الحل
//==================================================

function getSpeedRate(minutes){

    if(minutes==null)
        return "-";

    if(minutes<=30)
        return "ممتاز";

    if(minutes<=60)
        return "جيد جداً";

    if(minutes<=180)
        return "جيد";

    if(minutes<=360)
        return "مقبول";

    return "ضعيف";

}

//==================================================
// كلاس لون التقييم
//==================================================

function getRateClass(rate){

    switch(rate){

        case "ممتاز":
            return "rate-excellent";

        case "جيد جداً":
            return "rate-verygood";

        case "جيد":
            return "rate-good";

        case "مقبول":
            return "rate-average";

        default:
            return "rate-poor";

    }

}

//==================================================
// متوسط تقييم المستخدمين
//==================================================

function getRatingText(list){

    let total=0;

    let count=0;

    for(let t of list){

        if(t.rating?.rating){

            total+=Number(

                t.rating.rating

            );

            count++;

        }

    }

    if(count==0)
        return "لا يوجد";

    let avg=total/count;

    if(avg>=4.5)
        return "ممتاز";

    if(avg>=3.5)
        return "جيد جداً";

    if(avg>=2.5)
        return "جيد";

    if(avg>=1.5)
        return "مقبول";

    return "ضعيف";

}

//==================================================
// حساب إحصائيات المهندس
//==================================================

function calculateEngineerStatistics(list){

    let totalMinutes=0;

    let solvedTickets=0;

    for(let t of list){

        if(!t.solution)
            continue;

        let minutes=getMinutes(

            t.created_at,

            t.solution.created_at

        );

        if(minutes==null)
            continue;

        t.solveMinutes=minutes;

        totalMinutes+=minutes;

        solvedTickets++;

    }

    let avgMinutes=0;

    if(solvedTickets>0){

        avgMinutes=Math.round(

            totalMinutes/solvedTickets

        );

    }

    return{

        totalMinutes,

        avgMinutes,

        solvedTickets,

        speedRate:getSpeedRate(avgMinutes)

    };

}

//==================================================
// تنسيق التاريخ
//==================================================

function formatDate(date){

    if(!date)
        return "";

    return new Date(date)

        .toLocaleString(

            "ar-EG",

            {

                year:"numeric",

                month:"2-digit",

                day:"2-digit",

                hour:"2-digit",

                minute:"2-digit"

            }

        );

}

//==================================================
// عدد الحالات
//==================================================

function countStatus(list,status){

    return list.filter(

        t=>t.status==status

    ).length;

}

//==================================================
// إنشاء التقرير
//==================================================

async function viewReport(){

    const ROWS_PER_PAGE = 20;

    let {tickets,engineers}=await loadReportData();

    let from=fromDate.value||"-";
    let to=toDate.value||"-";

    let html="";

    for(let engineer of engineers){

        let list=tickets.filter(t=>t.assigned_to==engineer.id);

        if(list.length==0) continue;

        list=sortTickets(list);

        let stats=calculateEngineerStatistics(list);

        let open=countStatus(list,"open");
        let progress=countStatus(list,"in_progress");
        let resolved=countStatus(list,"resolved");
        let closed=countStatus(list,"closed");

        let rating=getRatingText(list);

        let totalPages=Math.ceil(list.length/ROWS_PER_PAGE);

        //-------------------------------------------------
        // صفحات بيانات التذاكر
        //-------------------------------------------------

        for(let page=0;page<totalPages;page++){

            let rows=list.slice(

                page*ROWS_PER_PAGE,

                (page+1)*ROWS_PER_PAGE

            );

            html+=`

<div class="report-page">

<div class="header-flex">

<img src="photo/logo.png" width="85">

<div class="center-title">

<h2>

تقرير تقييمات وسرعة حل مشاكل الموظفين

</h2>

<div>

الفترة من

<b>${from}</b>

إلى

<b>${to}</b>

</div>

</div>

<div>

${new Date().toLocaleDateString("ar-EG")}

</div>

</div>

`;

            //-------------------------------------------------
            // بيانات المهندس تظهر في الصفحة الأولى فقط
            //-------------------------------------------------

            if(page==0){

                html+=`

<h3>

بيانات موظف شؤون العاملين

</h3>

<table>

<tr>

<th>الاسم</th>

<th>الهاتف</th>

<th>الكلية</th>

<th>عدد التذاكر</th>

<th>متوسط زمن الحل</th>

<th>تقييم السرعة</th>

</tr>

<tr>

<td>${engineer.name}</td>

<td>${engineer.phone||""}</td>

<td>${engineer.faculty||""}</td>

<td>${list.length}</td>

<td>${formatMinutes(stats.avgMinutes)}</td>

<td>

<span class="${getRateClass(stats.speedRate)}">

${stats.speedRate}

</span>

</td>

</tr>

</table>

`;

            }

            //-------------------------------------------------

            html+=`

<h3>

تفاصيل التذاكر

</h3>

<table>

<thead>

<tr>

<th>الموظف</th>

<th>الكلية</th>

<th>الهاتف</th>

<th>عنوان التيكت</th>

<th>الوصف</th>

<th>الموقع</th>

<th>تاريخ الإنشاء</th>

<th>تاريخ الحل</th>

<th>الوقت المستغرق</th>

<th>السبب الفني</th>

<th>التقييم</th>

<th>الحالة</th>

</tr>

</thead>

<tbody>

`;
            //-------------------------------------------------
            // السجلات داخل الصفحة الحالية
            //-------------------------------------------------

            for(let t of rows){

                let minutes=getMinutes(
                    t.created_at,
                    t.solution?.created_at
                );

                html+=`

<tr>

<td>${t.creator?.name||""}</td>

<td>${t.creator?.faculty||""}</td>

<td>${t.creator?.phone||""}</td>

<td>${t.title||""}</td>

<td>${t.description||""}</td>

<td>${t.location||""}</td>

<td>${formatDate(t.created_at)}</td>

<td>${formatDate(t.solution?.created_at)}</td>

<td>${formatMinutes(minutes)}</td>

<td>${t.solution?.solution_text||""}</td>

<td>${t.rating?.rating??"-"}</td>

<td>${t.status}</td>

</tr>

`;

            }

            html+=`

</tbody>

</table>

<div class="page-footer">

<div>

موظف شؤون العاملين :
<b>${engineer.name}</b>

</div>

<div>

صفحة

${page+1}

من

${totalPages}

</div>

</div>

</div>

`;

        }

        //-------------------------------------------------
        // صفحة الملخص
        //-------------------------------------------------

        html+=`

<div class="report-page">

<div class="header-flex">

<img src="photo/logo.png" width="85">

<div class="center-title">

<h2>

ملخص التقرير

</h2>

<div>

${engineer.name}

</div>

</div>

<div>

${new Date().toLocaleDateString("ar-EG")}

</div>

</div>

<h3>

الإحصائيات النهائية

</h3>

<table>

<tr>

<th>عدد التذاكر</th>

<th>مفتوحة</th>

<th>جاري العمل</th>

<th>تم الحل</th>

<th>مغلقة</th>

<th>إجمالي زمن الحل</th>

<th>متوسط زمن الحل</th>

<th>تقييم السرعة</th>

<th>متوسط تقييم المستخدم</th>

</tr>

<tr>

<td>${list.length}</td>

<td>${open}</td>

<td>${progress}</td>

<td>${resolved}</td>

<td>${closed}</td>

<td>${formatMinutes(stats.totalMinutes)}</td>

<td>${formatMinutes(stats.avgMinutes)}</td>

<td>

<span class="${getRateClass(stats.speedRate)}">

${stats.speedRate}

</span>

</td>

<td>${rating}</td>

</tr>

</table>

<div class="summary-grid">

<div class="summary-card">

<h4>

عدد التذاكر

</h4>

<span>

${list.length}

</span>

</div>

<div class="summary-card">

<h4>

تم حلها

</h4>

<span>

${stats.solvedTickets}

</span>

</div>

<div class="summary-card">

<h4>

إجمالي زمن الحل

</h4>

<span>

${formatMinutes(stats.totalMinutes)}

</span>

</div>

<div class="summary-card">

<h4>

متوسط زمن الحل

</h4>

<span>

${formatMinutes(stats.avgMinutes)}

</span>

</div>

<div class="summary-card">

<h4>

تقييم السرعة

</h4>

<span>

${stats.speedRate}

</span>

</div>

<div class="summary-card">

<h4>

متوسط التقييم

</h4>

<span>

${rating}

</span>

</div>

</div>

<div class="page-footer">

<div>

${engineer.name}

</div>

<div>

ملخص التقرير

</div>

</div>

</div>

`;

    }

    //-------------------------------------------------

    if(html==""){

        html=`

<div class="empty">

<div class="empty-icon">

📊

</div>

<h2>

لا توجد بيانات

</h2>

<p>

لا توجد نتائج مطابقة للفلاتر المحددة.

</p>

</div>

`;

    }

    reportView.innerHTML=html;

}

//==================================================
// إنشاء ملف PDF احترافي
//==================================================

async function generatePDF(){

    let element=document.getElementById("reportView");

    if(element.innerHTML.trim()==""){

        alert("قم بعرض التقرير أولاً");

        return;

    }

    const opt={

        margin:[0.2,0.2,0.2,0.2],

        filename:
        "Evaluation_Report.pdf",

        image:{
            type:"jpeg",
            quality:1
        },

        html2canvas:{

            scale:2,

            useCORS:true,

            scrollY:0,

            scrollX:0,

            windowWidth:element.scrollWidth

        },

        jsPDF:{

            unit:"cm",

            format:"a4",

            orientation:"landscape"

        },

        pagebreak:{

            mode:["css","legacy"]

        }

    };

    const worker=

    html2pdf()

    .set(opt)

    .from(element)

    .toPdf()

    .get("pdf");

    worker.then(function(pdf){

        let totalPages=

        pdf.internal.getNumberOfPages();

        for(let page=1;page<=totalPages;page++){

            pdf.setPage(page);

            //-------------------------------------------------
            // Footer
            //-------------------------------------------------

            pdf.setFontSize(9);

            pdf.text(

                "صفحة "+page+" من "+totalPages,

                pdf.internal.pageSize.getWidth()-5,

                pdf.internal.pageSize.getHeight()-0.4

            );

            //-------------------------------------------------
            // تاريخ الطباعة
            //-------------------------------------------------

            pdf.text(

                new Date().toLocaleString("ar-EG"),

                0.5,

                pdf.internal.pageSize.getHeight()-0.4

            );

        }

    })

    .then(function(){

        worker.save();

    });

}



//==================================================
// تصدير Excel
//==================================================

async function generateExcel(){

    let data=await loadReportData();

    let tickets=data.tickets;

    let csv="\ufeff";

    csv+="الموظف,";
    csv+="الكلية,";
    csv+="الهاتف,";
    csv+="العنوان,";
    csv+="الوصف,";
    csv+="الموقع,";
    csv+="المهندس,";
    csv+="تاريخ الإنشاء,";
    csv+="تاريخ الحل,";
    csv+="الوقت المستغرق بالدقائق,";
    csv+="السبب الفني,";
    csv+="التقييم,";
    csv+="الحالة\n";

    for(let t of tickets){

        let minutes=getMinutes(

            t.created_at,

            t.solution?.created_at

        );

        csv+=`"${t.creator?.name||""}",`;
        csv+=`"${t.creator?.faculty||""}",`;
        csv+=`"${t.creator?.phone||""}",`;
        csv+=`"${t.title||""}",`;
        csv+=`"${t.description||""}",`;
        csv+=`"${t.location||""}",`;
        csv+=`"${t.engineer?.name||""}",`;
        csv+=`"${formatDate(t.created_at)}",`;
        csv+=`"${formatDate(t.solution?.created_at)}",`;
        csv+=`"${minutes??""}",`;
        csv+=`"${t.solution?.solution_text||""}",`;
        csv+=`"${t.rating?.rating||""}",`;
        csv+=`"${t.status}"\n`;

    }

    let blob=new Blob(

        [csv],

        {

            type:"text/csv;charset=utf-8;"

        }

    );

    let link=document.createElement("a");

    link.href=URL.createObjectURL(blob);

    link.download="evaluation_report.csv";

    link.click();

}