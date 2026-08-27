// ============================================
// Firebase Setup
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyBnJC2eyca71bKQZpKulvRz0zXnq2G4po4",
    authDomain: "schoolmanager-7b46a.firebaseapp.com",
    databaseURL: "https://schoolmanager-7b46a-default-rtdb.firebaseio.com",
    projectId: "schoolmanager-7b46a",
    storageBucket: "schoolmanager-7b46a.firebasestorage.app",
    messagingSenderId: "1024080935628",
    appId: "1:1024080935628:web:76bd7173c78305d686e069"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================
// ذخیره‌سازی هیبریدی (Firebase + LocalStorage) - نسخه کاملاً ایمن
// ============================================
function getSchoolData() {
    // خواندن یکباره از Firebase
    db.ref('schoolData').once('value').then((snapshot) => {
        let data = snapshot.val() || { teachers: [], admins: [] };
        
        // اطمینان از وجود آرایه‌ها (اگر undefined بود، آرایه خالی بذار)
        if (!data.teachers) data.teachers = [];
        if (!data.admins) data.admins = [];
        
        // پاک کردن داده‌های اضافی و خراب
        delete data.subscriptionEndDate;
        delete data.subscriptionStartDate;
        delete data.admin;
        
        localStorage.setItem('school_data', JSON.stringify(data));
    });
    
    // برگرداندن اطلاعات از LocalStorage (همان لحظه) - با ایمنی کامل
    let localData = JSON.parse(localStorage.getItem('school_data'));
    
    // اگر داده خراب یا ناقص بود، یک ساختار تمیز برگردون
    if (!localData || typeof localData !== 'object') return { teachers: [], admins: [] };
    if (!localData.teachers) localData.teachers = [];
    if (!localData.admins) localData.admins = [];
    
    // پاک کردن داده‌های اضافی
    delete localData.subscriptionEndDate;
    delete localData.subscriptionStartDate;
    delete localData.admin;
    
    return localData;
}

function saveSchoolData(data) {
    // تمیز کردن داده قبل از ذخیره
    if (!data.teachers) data.teachers = [];
    if (!data.admins) data.admins = [];
    
    localStorage.setItem('school_data', JSON.stringify(data));
    db.ref('schoolData').set(data);
}

function getGradesByClass(classId) {
    db.ref(`grades/${classId}`).once('value').then((snapshot) => {
        if (snapshot.val()) {
            localStorage.setItem(`grades_${classId}`, JSON.stringify(snapshot.val()));
        }
    });
    return JSON.parse(localStorage.getItem(`grades_${classId}`)) || [];
}

function saveGradesByClass(classId, grades) {
    localStorage.setItem(`grades_${classId}`, JSON.stringify(grades));
    db.ref(`grades/${classId}`).set(grades);
}

function getAttendanceByClass(classId) {
    db.ref(`attendance/${classId}`).once('value').then((snapshot) => {
        if (snapshot.val()) {
            localStorage.setItem(`attendance_${classId}`, JSON.stringify(snapshot.val()));
        }
    });
    return JSON.parse(localStorage.getItem(`attendance_${classId}`)) || {};
}

function saveAttendanceByClass(classId, data) {
    localStorage.setItem(`attendance_${classId}`, JSON.stringify(data));
    db.ref(`attendance/${classId}`).set(data);
}

// ============================================
// سیستم اشتراک مدیر
// ============================================

function activateSubscription(code) {
    const school = getSchoolData();
    const admin = school.admins.find(a => a.subscriptionCode === code.trim().toUpperCase());
    
    if (!admin) {
        return { success: false, message: "کد اشتراک اشتباه است!" };
    }
    
    if (!admin.subscriptionStartDate) {
        admin.subscriptionStartDate = new Date().toISOString().split('T')[0];
        admin.subscriptionEndDate = new Date();
        admin.subscriptionEndDate.setFullYear(admin.subscriptionEndDate.getFullYear() + 1);
        admin.subscriptionEndDate = admin.subscriptionEndDate.toISOString().split('T')[0];
        
        saveSchoolData(school);
    }
    
    const today = new Date().toISOString().split('T')[0];
    if (today > admin.subscriptionEndDate) {
        return { success: false, message: "کد اشتراک شما منقضی شده است!" };
    }
    
    localStorage.setItem('subscription_status', 'active');
    localStorage.setItem('activeAdminId', admin.id);
    return { success: true, message: "اشتراک فعال شد!" };
}

function checkSubscription() {
    return localStorage.getItem('subscription_status') === 'active';
}

// ============================================
// سیستم احراز هویت
// ============================================

function loginAdmin(username, password) {
    const school = getSchoolData();
    const admin = school.admins.find(a => a.username === username && a.password === password);
    if (admin) {
        localStorage.setItem('currentUser', username);
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('activeAdminId', admin.id);
        
        if (admin.subscriptionStartDate) {
            localStorage.setItem('subscription_status', 'active');
        }
        
        return { success: true };
    }
    return { success: false };
}

function loginTeacher(username, password) {
    const school = getSchoolData();
    const teacher = school.teachers.find(t => t.username === username && t.password === password);
    if (teacher) {
        localStorage.setItem('currentUser', username);
        localStorage.setItem('userRole', 'teacher');
        localStorage.setItem('teacherId', teacher.id);
        return { success: true };
    }
    return { success: false };
}

function loginStudent(className, studentName, password) {
    const school = getSchoolData();
    for (let teacher of school.teachers) {
        for (let cls of teacher.classes) {
            if (cls.name === className) {
                const student = cls.students.find(s => s.name === studentName && s.password === password);
                if (student) {
                    localStorage.setItem('currentUser', studentName);
                    localStorage.setItem('userRole', 'student');
                    localStorage.setItem('classId', cls.id);
                    localStorage.setItem('teacherId', teacher.id);
                    return true;
                }
            }
        }
    }
    return false;
}

// ============================================
// سیستم مالک (صالح)
// ============================================

function generateOwnerCode() {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SALEH-${year}-${random}`;
}

function createAdminByOwner(username, password, schoolName, code) {
    const newAdminRef = db.ref('admins').push();
    newAdminRef.set({
        id: newAdminRef.key,
        username: username,
        password: password,
        schoolName: schoolName,
        subscriptionCode: code,
        createdAt: new Date().toLocaleDateString('fa-IR')
    });
    
    const school = getSchoolData();
    const newAdmin = {
        id: newAdminRef.key,
        username: username,
        password: password,
        schoolName: schoolName,
        subscriptionCode: code,
        createdAt: new Date().toLocaleDateString('fa-IR')
    };
    school.admins.push(newAdmin);
    saveSchoolData(school);
    
    return { success: true };
}

function getAdminsList() {
    db.ref('admins').once('value').then((snapshot) => {
        const admins = [];
        snapshot.forEach((childSnapshot) => {
            admins.push(childSnapshot.val());
        });
        localStorage.setItem('admins_list', JSON.stringify(admins));
    });
    
    return JSON.parse(localStorage.getItem('admins_list')) || [];
}

function deleteAdminByOwner(adminId) {
    const school = getSchoolData();
    const initialLength = school.admins.length;
    school.admins = school.admins.filter(a => a.id !== adminId);
    
    if (school.admins.length === initialLength) {
        return { success: false, message: "مدیر یافت نشد!" };
    }
    
    saveSchoolData(school);
    return { success: true };
}

// ============================================
// توابع کمکی (معلم، دانش‌آموز، ...)
// ============================================

function createTeacherByAdmin(teacherUsername, teacherPassword, teacherSchoolName) {
    // ذخیره مستقیم در Firebase (مسیر teachers)
    const newTeacherRef = db.ref('teachers').push();
    newTeacherRef.set({
        id: newTeacherRef.key,
        username: teacherUsername,
        password: teacherPassword,
        schoolName: teacherSchoolName,
        classes: []
    });
    
    // همچنین در LocalStorage ذخیره کن
    const school = getSchoolData();
    const newTeacher = {
        id: newTeacherRef.key,
        username: teacherUsername,
        password: teacherPassword,
        schoolName: teacherSchoolName,
        classes: []
    };
    school.teachers.push(newTeacher);
    saveSchoolData(school);
    
    return true;
}

function getTeachersList() {
    // خواندن معلم‌ها از Firebase (مسیر teachers)
    db.ref('teachers').once('value').then((snapshot) => {
        const teachers = [];
        snapshot.forEach((childSnapshot) => {
            teachers.push(childSnapshot.val());
        });
        localStorage.setItem('teachers_list', JSON.stringify(teachers));
    });
    
    // برگرداندن از LocalStorage
    return JSON.parse(localStorage.getItem('teachers_list')) || [];
}

function generateRandomPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

function getStudentsList(teacherId, classId) {
    const school = getSchoolData();
    const teacher = school.teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    const cls = teacher.classes.find(c => c.id === classId);
    return cls ? cls.students : [];
}

function addStudentToClass(teacherId, classId, studentName) {
    const school = getSchoolData();
    const teacher = school.teachers.find(t => t.id === teacherId);
    if (!teacher) return false;
    const cls = teacher.classes.find(c => c.id === classId);
    if (!cls) return false;

    let newId = Date.now().toString() + Math.floor(Math.random() * 1000);
    let newPass = generateRandomPassword();
    let isUnique = false;
    while (!isUnique) {
        const exists = cls.students.find(s => s.password === newPass);
        if (!exists) isUnique = true;
        else newPass = generateRandomPassword();
    }
    cls.students.push({ id: newId, name: studentName, password: newPass });
    saveSchoolData(school);
    return newPass;
}

function deleteStudentFromClass(teacherId, classId, studentId) {
    const school = getSchoolData();
    const teacher = school.teachers.find(t => t.id === teacherId);
    if (!teacher) return false;
    const cls = teacher.classes.find(c => c.id === classId);
    if (!cls) return false;
    cls.students = cls.students.filter(s => s.id !== studentId);
    saveSchoolData(school);
    return true;
}

// ============================================
// توابع پشتیبان‌گیری و بازیابی
// ============================================

function exportBackup() {
    const school = getSchoolData();
    const allGrades = {};
    const allAttendance = {};
    
    school.teachers.forEach(t => {
        t.classes.forEach(cls => {
            allGrades[cls.id] = getGradesByClass(cls.id);
            allAttendance[cls.id] = getAttendanceByClass(cls.id);
        });
    });
    
    const data = {
        schoolData: school,
        grades: allGrades,
        attendance: allAttendance,
        backupDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'School_Backup.json';
    link.click();
    URL.revokeObjectURL(url);
    alert("نسخه پشتیبان با موفقیت تهیه شد! این فایل را جای امنی نگه دارید.");
}

function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(event) {
            const data = JSON.parse(event.target.result);
            
            if (data.schoolData) {
                saveSchoolData(data.schoolData);
            }
            
            if (data.grades) {
                const gradesKeys = Object.keys(data.grades);
                gradesKeys.forEach(key => {
                    saveGradesByClass(key, data.grades[key]);
                });
            }
            
            if (data.attendance) {
                const attendanceKeys = Object.keys(data.attendance);
                attendanceKeys.forEach(key => {
                    saveAttendanceByClass(key, data.attendance[key]);
                });
            }
            
            alert("دیتابیس با موفقیت بازیابی شد! حالا می‌توانید وارد شوید.");
            window.location.href = 'index.html';
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ============================================
// توابع عمومی (خروج)
// ============================================
function logout() {
    if (confirm("آیا می‌خواهید خارج شوید؟")) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('teacherId');
        localStorage.removeItem('classId');
        localStorage.removeItem('subscription_status');
        localStorage.removeItem('activeAdminId');
        window.location.href = 'index.html';
    }
}