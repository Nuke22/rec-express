const createError = require('http-errors');
const express = require('express');
const router = express.Router();
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongodb = require("mongodb");
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const {Int32, Double} = require("mongodb");

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true
}));

app.use('/', indexRouter);
app.use('/users', usersRouter);
//TODO БАЗА ДАННИХ
//Підключення до бази даних MongoDB
mongoose.connect('mongodb://localhost:27017/express', {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });

//Створення моделей
const User = mongoose.model('User', {
    first_name: String,
    second_name: String,
    email: String,
    password: String,
    role: {type: String, default: 'user'} // Значення за замовчуванням "user"
}, 'Users');

const Category = mongoose.model('Category', {
    name: String,
    rate: Number
}, 'Category');

//TODO МiddleWare
//Middleware для обробки JSON даних
app.use(bodyParser.json());
// Мідлвар для перевірки авторизації користувача та ролі перед доступом до захищених маршрутів
const authenticateUser = (req, res, next) => {
    if (req.session.user) {
        // Користувач авторизований

        // Перевірка ролі користувача
        if (req.session.user.role === 'admin') {
            // Дозволяємо доступ адміністраторам
            next();
        } else {
            // Редирект або відображення повідомлення про недостатні права доступу
            return res.status(403).send('<script>alert("У вас недостатньо прав для перегляду цієї сторінки"); window.history.back();</script>');
        }
    } else {
        // Користувач не авторизований, перенаправляємо на сторінку авторизації або відображаємо повідомлення
        return res.status(401).send('<script>alert("Потрібна авторизація"); window.location.href = "/login";</script>');
    }
};

// TODO Сторінка Адмін Панелі
app.get('/admin-panel', authenticateUser, (req, res) => {
    res.render('Admin/admin-panel', {title: 'Панель Адміністратора'});
});

//TODO Сторінка Домашня
app.get('/', function (req, res, next) {
    res.render('index', {title: 'Домашня сторінка', user: req.session.user,});
});

//TODO Сторінка Реєстрації
app.get('/register', function (req, res, next) {
    res.render('Auth/register', {title: 'Реєстрація'});
});

//TODO Сторінка Авторизації
app.get('/login', function (req, res, next) {
    res.render('Auth/login', {title: 'Реєстрація'});
});

//TODO Сторінка Пошуку
app.get('/search', function (req, res, next) {
    res.render('User/search', {title: 'Пошук'});
});

//TODO Сторінка Результатів
app.get('/result', function (req, res, next) {
    res.render('User/result', {title: 'Результати'});
});

// PvsTODO  Обробник форми реєстрації
// Роутер для обробки реєстрації
app.post('/register-user', async (req, res) => {
    try {
        const {first_name, second_name, email, password} = req.body;

        // Перевірка, чи користувач з таким ім'ям вже існує
        const existingUser = await User.findOne({email});
        if (existingUser) {
            return res.status(409).send('<script>alert("Даний E-mail уже зареєстрований в системі"); window.history.back();</script>');
        }

        // Хешування пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Створення нового користувача
        const newUser = new User({first_name, second_name, email, password: hashedPassword});
        await newUser.save();
        return res.send('<script>alert("Реєстрація пройшла успішно"); window.location.href = "/";</script>');

    } catch (error) {
        console.error('Error during registration:', error);
        return res.send('<script>alert("Виникла помилка під час реєстрації"); window.history.back();</script>');
    }
});

// TODO Обробник форми авторизації
// Роутер для обробки авторизації
app.post('/login-user', async (req, res) => {
    try {
        const {email, password} = req.body;

        // Пошук користувача за email
        const user = await User.findOne({email});
        if (!user) {
            return res.status(401).send('<script>alert("Користувача з таким E-mail не знайдено"); window.history.back();</script>');
        }

        // Перевірка пароля
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).send('<script>alert("Неправильний пароль"); window.history.back();</script>');
        }

        // Збереження інформації про авторизованого користувача в сесії
        req.session.user = user;

        // Успішна авторизація
        return res.send('<script>alert("Успішна авторизація"); window.location.href = "/";</script>');

    } catch (error) {
        console.error('Error during login:', error);
        return res.send('<script>alert("Виникла помилка під час авторизації"); window.history.back();</script>');
    }
});

//TODO Обробник розлогування
//Роутер для виходу з облікового запису
app.get('/logout', (req, res) => {
    // Видаляємо інформацію про користувача з сесії
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during logout:', err);
            return res.send('<script>alert("Виникла помилка під час виходу з облікового запису"); window.history.back();</script>');
        }
        return res.send('<script>alert("Ви вийшли з облікового запису"); window.location.href = "/";</script>');
    });
});

//TODO Обробник Додавання категорій(чи шо там, не зовсім поняв)


// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
module.exports = app;

