//==================================================
// إعداد الاتصال بـ Supabase
//==================================================

const SUPABASE_URL = "https://cqmhpvaaaduqbhjtyrgk.supabase.co/rest/v1/";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxbWhwdmFhYWR1cWJoanR5cmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTA3OTUsImV4cCI6MjA5NDE4Njc5NX0.eqZ69jTSRFvPhjSVx2KZe9-3LSw0cw8uAQ6D06ZkQFg";

const HEADERS = {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY
};

let user = JSON.parse(sessionStorage.getItem("user"));

if (!user || user.role !== "admin") {
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
// تحميل المهندسين
//==================================================

async function loadEngineers(){
    let engineers = await fetchAPI(
        SUPABASE_URL + "users?role=eq.it&order=name"
    );

    let html = `
        <option value="">
            جميع المهندسين
        </option>
    `;

    for(let e of engineers){
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
        SUPABASE_URL + "users?role=eq.employee&order=name"
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
// جلب بيانات التقرير الحقيقية من Supabase
//==================================================

async function loadReportData(){
    let from = fromDate.value;
    let to = toDate.value;

    let engineer = engineerFilter.value;
    let employee = employeeFilter.value;
    let faculty = facultyFilter.value;

    //------------------------------------------------
    // بناء رابط التذاكر مع العلاقات المجلوبة
    //------------------------------------------------

    let url = SUPABASE_URL + "tickets?" +
        "select=*," +
        "creator:users!tickets_created_by_fkey(id,name,phone,faculty)," +
        "engineer:users!tickets_assigned_to_fkey(id,name,phone,faculty)" +
        "&order=created_at.desc";

    let filters = [];

    if(from){
        filters.push("created_at=gte." + from);
    }

    if(to){
        filters.push("created_at=lte." + to + "T23:59:59");
    }

    if(engineer){
        filters.push("assigned_to=eq." + engineer);
    }

    if(employee){
        filters.push("created_by=eq." + employee);
    }

    if(faculty){
        filters.push("faculty=eq." + faculty);
    }

    if(filters.length){
        url += "&" + filters.join("&");
    }

    //------------------------------------------------
    // تحميل البيانات من الجداول المختلفة
    //------------------------------------------------

    let tickets = await fetchAPI(url);

    let solutions = await fetchAPI(
        SUPABASE_URL + "ticket_solution?select=ticket_id,solution_text,created_at"
    );

    let ratings = await fetchAPI(
        SUPABASE_URL + "ratings"
    );

    let engineersList = await fetchAPI(
        SUPABASE_URL + "users?role=eq.it&order=name"
    );

    //------------------------------------------------
    // دمج الحلول والتقييمات مع التذاكر المطابقة
    //------------------------------------------------

    for(let ticket of tickets){
        ticket.solution = solutions.find(s => s.ticket_id == ticket.id);
        ticket.rating = ratings.find(r => r.ticket_id == ticket.id);
    }

    return {
        tickets,
        engineers: engineersList
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

    return Math.round((d2-d1)/60000);
}

//==================================================
// تحويل الدقائق إلى نص مقروء
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
            total+=Number(t.rating.rating);
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

        let minutes=getMinutes(t.created_at, t.solution.created_at);

        if(minutes==null)
            continue;

        t.solveMinutes=minutes;
        totalMinutes+=minutes;
        solvedTickets++;
    }

    let avgMinutes=0;
    if(solvedTickets>0){
        avgMinutes=Math.round(totalMinutes/solvedTickets);
    }

    return{
        totalMinutes,
        avgMinutes,
        solvedTickets,
        speedRate:getSpeedRate(avgMinutes)
    };
}

//==================================================
// تنسيق التاريخ والساعة
//==================================================

function formatDate(date) {
    if (!date) return "-";

    // تحويل القيمة الحالية إلى نص لمعالجتها
    let dateStr = String(date);

    // إذا كان التوقيت قادماً من الخادم بدون تحديد المنطقة الزمنية (Z أو +)، نقوم بإضافتها ليتم احتساب فارق التوقيت
    if (!dateStr.includes("Z") && !dateStr.includes("+")) {
        dateStr += "Z";
    }

    return new Date(dateStr).toLocaleString("ar-EG", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true // يُفضل استخدام نظام 12 ساعة لبيان (صباحاً/مساءً) بوضوح في التقارير
    });
}

//==================================================
// عدد الحالات
//==================================================

function countStatus(list,status){
    return list.filter(t=>t.status==status).length;
}

//==================================================
// وظيفة محاكاة تصدير ملف الـ Excel 
//==================================================
function generateExcel() {
    alert("تم تجهيز التقرير للتصدير بصيغة Excel.");
}

//==================================================
// دالة بناء وعرض التقرير الأساسية داخل الصفحة (viewReport)
//==================================================

async function viewReport(){
    const ROWS_PER_PAGE = 20;

    let {tickets,engineers}=await loadReportData();

    let from=fromDate.value||"-";
    let to=toDate.value||"-";
    let selectedEng = engineerFilter.value;

    let html="";

    // فلترة المهندسين المستهدفين بناءً على الفلتر المختار
    let targetEngineers = engineers;
    if(selectedEng){
        targetEngineers = engineers.filter(e => e.id == selectedEng);
    }

    for(let engineer of targetEngineers){

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

        // صفحات بيانات التذاكر
        for(let page=0;page<totalPages;page++){

            let rows=list.slice(page*ROWS_PER_PAGE, (page+1)*ROWS_PER_PAGE);

            html+=`
            <div class="report-page">
                <div class="header-flex">
                    <img src="photo/logo.png" width="85" onerror="this.src='https://via.placeholder.com/85'">
                    <div class="center-title">
                        <h2>تقرير تذاكر  مهندسي IT</h2>
                        <div>الفترة من <b>${from}</b> إلى <b>${to}</b></div>
                    </div>
                    <div>${new Date().toLocaleDateString("ar-EG")}</div>
                </div>
            `;

            // بيانات المهندس تظهر في الصفحة الأولى فقط
            if(page==0){
                html+=`
                <h3>بيانات المهندس</h3>
                <table>
                    <thead>
                        <tr>
                            <th>الاسم</th>
                            <th>الهاتف</th>
                            <th>الكلية</th>
                            <th>عدد التذاكر</th>
                            <th>متوسط زمن الحل</th>
                            <th>تقييم السرعة</th>
                        </tr>
                    </thead>
                    <tbody>
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
                    </tbody>
                </table>
                `;
            }

            html+=`
            <h3>تفاصيل التذاكر</h3>
            <table>
                <thead>
                    <tr>
                        <th>الموظف</th>
                        <th>الكلية</th>
                        <th>الهاتف</th>
                        <th>العنوان</th>
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

            // السجلات داخل الصفحة الحالية
            for(let t of rows){
                let minutes=getMinutes(t.created_at, t.solution?.created_at);

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
                <div>المهندس : <b>${engineer.name}</b></div>
                <div>صفحة ${page+1} من ${totalPages}</div>
            </div>
            </div>
            `;
        }

        // صفحة الملخص لكل مهندس
        html+=`
        <div class="report-page">
            <div class="header-flex">
                <img src="photo/logo.png" width="85" onerror="this.src='https://via.placeholder.com/85'">
                <div class="center-title">
                    <h2>ملخص التقرير</h2>
                    <div>${engineer.name}</div>
                </div>
                <div>${new Date().toLocaleDateString("ar-EG")}</div>
            </div>
            
            <h3>الإحصائيات النهائية</h3>
            <table>
                <thead>
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
                </thead>
                <tbody>
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
                </tbody>
            </table>

            <div class="summary-grid">
                <div class="summary-card">
                    <h4>عدد التذاكر</h4>
                    <span>${list.length}</span>
                </div>
                <div class="summary-card">
                    <h4>تم حلها</h4>
                    <span>${stats.solvedTickets}</span>
                </div>
                <div class="summary-card">
                    <h4>إجمالي زمن الحل</h4>
                    <span>${formatMinutes(stats.totalMinutes)}</span>
                </div>
                <div class="summary-card">
                    <h4>متوسط زمن الحل</h4>
                    <span>${formatMinutes(stats.avgMinutes)}</span>
                </div>
                <div class="summary-card">
                    <h4>تقييم السرعة</h4>
                    <span>${stats.speedRate}</span>
                </div>
                <div class="summary-card">
                    <h4>متوسط التقييم</h4>
                    <span>${rating}</span>
                </div>
            </div>

            <div class="page-footer">
                <div>${engineer.name}</div>
                <div>ملخص التقرير</div>
            </div>
        </div>
        `;
    }

    if(html==""){
        html=`
        <div class="empty">
            <div class="empty-icon">📊</div>
            <h2>لا توجد بيانات</h2>
            <p>لا توجد نتائج مطابقة للفلاتر المحددة.</p>
        </div>
        `;
    }

    reportView.innerHTML=html;
}

//===================================================================
// 5. دوال اختيار الحقول والطباعة الاحترافية عبر المتصفح (PDF نصوص تفاعلية)
//===================================================================

function generatePDF() {
    let reportView = document.getElementById("reportView");
    
    if (!reportView || reportView.innerHTML.trim() === "" || reportView.querySelector('.empty')) {
        alert("يرجى عرض التقرير أولاً للحصول على بيانات للطباعة.");
        return;
    }

    let modal = document.getElementById("pdfFieldsModal");
    if (modal) modal.remove();

    modal = document.createElement("div");
    modal.id = "pdfFieldsModal";
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(5px);
        display: flex; align-items: center; justify-content: center;
        z-index: 99999; direction: rtl; font-family: 'Cairo', sans-serif;
    `;

    modal.innerHTML = `
        <div style="background: #ffffff; color: #333; padding: 25px; border-radius: 16px; width: 90%; max-width: 550px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid #ddd;">
            <h3 style="margin-top: 0; color: #0d6efd; font-size: 20px; text-align: center; margin-bottom: 15px;">اختر حقول تفاصيل التذاكر المراد إظهارها في الطباعة</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 14px;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="0" checked> الموظف</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="1" checked> الكلية</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="2" checked> الهاتف</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="3" checked> العنوان</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="4" checked> الوصف</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="5" checked> الموقع</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="6" checked> تاريخ الإنشاء</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="7" checked> تاريخ الحل</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="8" checked> الوقت المستغرق</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="9" checked> السبب الفني</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="10" checked> التقييم</label>
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px;"><input type="checkbox" class="pdf-field-cb" value="11" checked> الحالة</label>
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelPdfBtn" style="background: #6c757d; color: white; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit;">إلغاء</button>
                <button id="confirmPdfBtn" style="background: #0d6efd; color: white; border: none; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-weight: bold; font-family: inherit;">معاينة وطباعة</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById("cancelPdfBtn").onclick = () => modal.remove();
    document.getElementById("confirmPdfBtn").onclick = () => {
        const selectedIndices = Array.from(document.querySelectorAll(".pdf-field-cb:checked")).map(cb => parseInt(cb.value));
        if (selectedIndices.length === 0) {
            alert("يرجى اختيار حقل واحد على الأقل للطباعة!");
            return;
        }
        modal.remove();
        executeBrowserPrint(selectedIndices);
    };
}

function executeBrowserPrint(selectedIndices) {
    let reportView = document.getElementById("reportView");
    let clonedReport = reportView.cloneNode(true);
    let ticketTables = clonedReport.querySelectorAll("table");
    
    ticketTables.forEach(table => {
        let ths = table.querySelectorAll("thead th");
        if (ths.length > 0 && ths[0].textContent.trim() === "الموظف") {
            ths.forEach((th, idx) => {
                if (!selectedIndices.includes(idx)) th.style.display = "none";
            });
            let rows = table.querySelectorAll("tbody tr");
            rows.forEach(tr => {
                let tds = tr.querySelectorAll("td");
                tds.forEach((td, idx) => {
                    if (!selectedIndices.includes(idx)) td.style.display = "none";
                });
            });
        }
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <meta charset="UTF-8">
            <title>تقرير تقييمات وسرعة حل الأعطال</title>
            <style>
                @page { size: A4 landscape; margin: 10mm; }
                body {
                    font-family: 'Cairo', sans-serif;
                    margin: 0; padding: 0; direction: rtl;
                    background: #fff; color: #000;
                    -webkit-print-color-adjust: exact; print-color-adjust: exact;
                }
                .report-page {
                    width: 100%; box-sizing: border-box; padding: 10px;
                    page-break-after: always; break-after: page; position: relative;
                }
                .header-flex {
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-bottom: 15px;
                }
                .center-title { text-align: center; flex: 1; }
                .center-title h2 { color: #0d6efd; margin: 0 0 5px 0; font-size: 20px; }
                h3 { color: #0d6efd; margin: 15px 0 10px 0; font-size: 16px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px; }
                table th { background-color: #0d6efd !important; color: white !important; padding: 8px 4px; border: 1px solid #ccc; text-align: center; }
                table td { border: 1px solid #ccc; padding: 6px 4px; text-align: center; word-break: break-word; }
                .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 15px; }
                .summary-card { background: #f8f9fa !important; border-top: 3px solid #0d6efd; border-radius: 6px; padding: 10px; text-align: center; }
                .summary-card h4 { margin: 0 0 5px 0; font-size: 12px; color: #555; }
                .summary-card span { font-size: 16px; font-weight: bold; color: #0d6efd; }
                .page-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 11px; color: #666; }
                .rate-excellent { background: #198754 !important; color: white !important; padding: 2px 6px; border-radius: 4px; }
                .rate-verygood { background: #0dcaf0 !important; color: white !important; padding: 2px 6px; border-radius: 4px; }
                .rate-good { background: #ffc107 !important; color: black !important; padding: 2px 6px; border-radius: 4px; }
                .rate-average { background: #fd7e14 !important; color: white !important; padding: 2px 6px; border-radius: 4px; }
                .rate-poor { background: #dc3545 !important; color: white !important; padding: 2px 6px; border-radius: 4px; }
            </style>
        </head>
        <body>
            ${clonedReport.innerHTML}
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        window.close();
                    }, 300);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}