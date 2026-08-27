// اطلاعات معلم اول
const teacherUsername = "admin";
const teacherPassword = "123456";
const schoolName = "دبیرستان نمونه";

// بارگذاری دیتابیس فعلی
let schoolData = JSON.parse(localStorage.getItem('school_data')) || { teachers: [], classes: [] };

// چک کردن اینکه آیا این معلم قبلاً ثبت نشده؟
const exists = schoolData.teachers.find(t => t.username === teacherUsername);
if (!exists) {
    const newTeacher = {
        id: Date.now().toString(),
        username: teacherUsername,
        password: teacherPassword,
        schoolName: schoolName,
        classes: []
    };
    schoolData.teachers.push(newTeacher);
    localStorage.setItem('school_data', JSON.stringify(schoolData));
    alert(`معلم با نام کاربری ${teacherUsername} و رمز ${teacherPassword} ساخته شد!`);
} else {
    alert("این نام کاربری قبلاً ثبت شده است!");
}