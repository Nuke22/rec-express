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
    role: {type: String, default: 'user'}
}, 'Users');

const Category = mongoose.model('Category', {
    title: String,
    type: String,
    params: [
        {
            index: String,
            title: String,
            rating: Number
        }]
    }, 'Category');

const TypeOfResource = mongoose.model("TypeOfResource", {
    name: String
},'TypeOfResource')

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
app.get('/admin/panel', authenticateUser, async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('Admin/admin-panel', {title: 'Панель Адміністратора', cat: categories});
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Помилка під час отримання категорій');
    }
});

//TODO Сторінка Домашня
app.get('/', async (req, res, next) => {
    const categories = await TypeOfResource.find();
    console.log(categories)
    res.render('index', {title: 'Домашня сторінка', user: req.session.user, categories: categories});
});

//TODO Сторінка Реєстрації
app.get('/register', function (req, res, next) {
    res.render('Auth/register', {title: 'Реєстрація'});
});

//TODO Сторінка Авторизації
app.get('/login', function (req, res, next) {
    res.render('Auth/login', {title: 'Реєстрація'});
});

//TODO Сторінка Результатів
app.get('/result', function (req, res, next) {
    res.render('User/result', {title: 'Результати'});
});
// TODO Сторінка Додавання категорій
app.get('/admin/panel/add', authenticateUser, (req, res) => {
    res.render('Admin/add-category', { title: 'Додати категорію' });
});

// TODO  Обробник форми реєстрації
// Роутер для обробки реєстрації
app.post('/register/user', async (req, res) => {
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
app.post('/login/user', async (req, res) => {
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

// TODO Обробник форми Додавання категорій
app.post('/add', async (req, res) => {
    try {
        const {title,type,rating1,rating2,rating3,rating4,rating5,rating6,rating7,rating8,rating9,rating10} = req.body;

        // Перевірка, чи категорія з таким ім'ям вже існує
        const existingCategory = await User.findOne({title});
        if (existingCategory) {
            return res.status(409).send('<script>alert("Дана Категорія уже зареєстрована в системі"); window.history.back();</script>');
        }

        // Створення нової категорії
        const newCategory = new Category({
            title,
            type,
            params: [
                {
                    title: 'Інтерактивність',
                    rating: rating1,
                    index:1
                },
                {
                    title: 'Мультимедійність',
                    rating: rating2,
                    index:2
                },
                {
                    title: 'Можливість модифікації',
                    rating: rating3,
                    index:3
                },
                {
                    title: 'Кросплатформеність',
                    rating: rating4,
                    index: 4
                },
                {
                    title: 'Вільнопоширюваність',
                    rating: rating5,
                    index: 5
                },
                {
                    title: 'Архітектура',
                    rating: rating6,
                    index: 6
                },
                {
                    title: 'Функціональність',
                    rating: rating7,
                    index: 7,
                },
                {
                    title: 'Чисельність тем для опрацювання',
                    rating: rating8,
                    index: 8
                },
                {
                    title: 'Відповідність предметній області',
                    rating: rating9,
                    index: 9
                },
                {
                    title: 'Відповідність навчального змісту освітнім стандартам',
                    rating: rating10,
                    index: 10
                },
            ]

        });
        await newCategory.save();
        return res.send('<script>alert("Додавання пройшло успішно"); window.location.href = "/admin/panel";</script>');

    } catch (error) {
        console.error('Error during adding:', error);
        return res.send('<script>alert("Виникла помилка під час додавання"); window.history.back();</script>');
    }
});

// TODO Обробник видалення категорії
app.get('/delete-category/:id', authenticateUser, async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Виконуємо операцію видалення категорії за її ID
        await Category.findByIdAndDelete(categoryId);

        return res.send('<script>alert("Категорія успішно видалена"); window.location.href = "/admin/panel";</script>');
    } catch (error) {
        console.error('Error during category deletion:', error);
        return res.send('<script>alert("Виникла помилка під час видалення категорії"); window.history.back();</script>');
    }
});

// TODO Обробник редагування категорії (показ форми та збереження змін)
app.get('/edit-category/:id', authenticateUser, async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Отримуємо категорію за її ID
        const category = await Category.findById(categoryId);

        // Передаємо дані категорії до шаблону для відображення у формі
        return res.render('Admin/edit-category.twig', { category });
    } catch (error) {
        console.error('Error during category editing:', error);
        return res.send('<script>alert("Виникла помилка під час редагування категорії"); window.history.back();</script>');
    }
});

// TODO Обробник збереження змін у категорії
app.post('/edit-category/:id', authenticateUser, async (req, res) => {
    try {
        const categoryId = req.params.id;
        const { title, type } = req.body;

        // Оновлення назви та типу категорії
        await Category.findByIdAndUpdate(categoryId, { title, type });

        // Оновлення параметрів категорії
        const paramKeys = Object.keys(req.body).filter(key => key.startsWith('filter'));
        for (const key of paramKeys) {
            const index = key.replace('filter', '');
            const rating = req.body[key];
            await Category.findOneAndUpdate(
                { _id: categoryId, 'params.index': index },
                { $set: { 'params.$.rating': rating } }
            );
        }

        return res.send('<script>alert("Категорія успішно оновлена"); window.location.href = "/admin/panel";</script>');
    } catch (error) {
        console.error('Error during category update:', error);
        return res.send('<script>alert("Виникла помилка під час оновлення категорії"); window.history.back();</script>');
    }
});



// TODO Обробник Типу категорій навчальних ресурсів

app.post("/apply-resource", async (req, res) => {
    try {
        // Отримуємо вибрані типи ресурсів з тіла запиту
        // Зберігаємо вибрані типи ресурсів в сесії
        req.session.selectedTof = req.body;
        req.session.selectedTof
        // Перенаправляємо користувача на іншу сторінку або рендеримо новий шаблон
        res.redirect('/'); // При необхідності можна перенаправити на будь-яку іншу сторінку

    } catch (error) {
        console.error('Error during applying resource:', error);
        return res.status(500).send('Виникла помилка під час застосування ресурсу');
    }
});




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

