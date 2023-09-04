const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bcrypt = require('bcryptjs');
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

//Підключення до бази даних MongoDB
mongoose.connect('mongodb://localhost:27017/express', {useNewUrlParser: true, useUnifiedTopology: true})
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });

// Створення моделей

const User = mongoose.model('User', {
    first_name: String,
    second_name: String,
    email: String,
    password: String,
    role: {type: String, default: 'user'},
}, 'Users');

const Category = mongoose.model('Category', {
    title: String,
    type: String,
    addedBy: String,
    evaluated: {type: Boolean, default: false},
    evaluatedBy: [String],      // user email as identifier
    params: [],
    userMarks: []
}, 'Category');

const TypeOfResource = mongoose.model("TypeOfResource", {
    name: String
}, 'TypeOfResource')


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


// functionality of the page - you add some coma separated values in the text field. Then we find if any of the
//      input matches with an existing name in the DB (evaluated or not).
//      If yes - dont add a new doc in the DB.
//      If no  - add to the DB
app.get('/admin/panel/bulkData', authenticateUser, async (req, res) => {
    try {
        const categories = await TypeOfResource.find();
        if (req.session.reportAsNew === undefined) {
            req.session.reportAsNew = null
        }
        if (req.session.reportAsExisting === undefined) {
            req.session.reportAsExisting = null
        }

        res.render('Admin/bulk-data', {
            title: 'Панель завантаження нових систем',
            categories: categories,
            newCat: req.session.reportAsNew,
            existCat: req.session.reportAsExisting
        });
    } catch (error) {
        console.error('Error in bulkData:', error);
        res.status(500).send('Помилка');
    }
})


app.post("/bulk-handler", async (req, res) => {
    try {
        const {bulkData, type_of_resource} = req.body
        const existingCategoriesModel = await Category.find({"type": type_of_resource}, "title");  //debug this!!

        // purgatory
        let existingCategories = []
        for (let i = 0; i < existingCategoriesModel.length; i++) {
            existingCategories.push(existingCategoriesModel[i].title)
        }

        //format new names
        let bulkDataNoHtml = bulkData.replace(/\n|\r/g, '');
        let bulkDataArray = bulkDataNoHtml.split(",")
        let newNames = []
        for (let i = 0; i < bulkDataArray.length; i++) {
            let result = bulkDataArray[i].trim()
            newNames.push(result)
        }

        //remove empty elements from the array
        newNames = newNames.filter(element => element !== "")

        // separate new input from the existing one
        let reportAsExisting = []
        let reportAsNew = []
        for (let i = 0; i < newNames.length; i++) {
            if (existingCategories.includes(newNames[i])) {
                reportAsExisting.push(newNames[i])
            } else {
                reportAsNew.push(newNames[i])
            }
        }

        // put new input to the DB
        for (let i = 0; i < reportAsNew.length; i++) {
            let title = reportAsNew[i]
            let author = req.session.user.email
            console.log(author)
            const newSystem = new Category({
                title: title,
                type: type_of_resource,
                addedBy: author,
                evaluated: false,
                evaluatedBy: [],
                params: [
                    {
                        title: 'Інтерактивність',
                        rating: 0
                    },
                    {
                        title: 'Мультимедійність',
                        rating: 0
                    },
                    {
                        title: 'Можливість модифікації',
                        rating: 0
                    },
                    {
                        title: 'Кросплатформеність',
                        rating: 0
                    },
                    {
                        title: 'Вільнопоширюваність',
                        rating: 0
                    },
                    {
                        title: 'Архітектура',
                        rating: 0
                    },
                    {
                        title: 'Функціональність',
                        rating: 0
                    },
                    {
                        title: 'Чисельність тем для опрацювання',
                        rating: 0
                    },
                    {
                        title: 'Відповідність предметній області',
                        rating: 0
                    },
                    {
                        title: 'Відповідність навчального змісту освітнім стандартам',
                        rating: 0
                    }
                ]
            })
            await newSystem.save()
        }


        req.session.reportAsExisting = reportAsExisting
        req.session.reportAsNew = reportAsNew

        res.redirect("/admin/panel/bulkData")
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Помилка. О ні, тільки не помилка. Що ж тепер робити... Та нічого не роби, життя матриця, всі помруть');
    }
})

app.get('/admin/panel', authenticateUser, async (req, res) => {
    try {
        const author = req.session.user.email
        const evalSystem = await Category.find({evaluated: true});
        const partEvalSystem = await Category.find({evaluatedBy: author})
        const notEvalSystem = await Category.find({evaluatedBy: {$not: {$eq: author}}})
        res.render('Admin/admin-panel', {
            title: 'Панель Адміністратора', evalCat: evalSystem,
            userEvalSystem: partEvalSystem, notEvaledSystem:notEvalSystem, authorEmail:author
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Помилка під час отримання категорій');
    }
});


app.get('/', async (req, res, next) => {
    const categories = await TypeOfResource.find();
    console.log(categories)
    res.render('index', {title: 'Домашня сторінка', user: req.session.user, categories: categories});
});


app.get('/register', function (req, res, next) {
    res.render('Auth/register', {title: 'Реєстрація'});
});


app.get('/login', function (req, res, next) {
    res.render('Auth/login', {title: 'Реєстрація'});
});


app.get('/result', function (req, res, next) {
    let LOST_sorted1 = req.session.LOST_sorted

    //STEP - CSS MATH
    // tilts_array - values for rotate CSS function
    for (let i = 0; i < LOST_sorted1.length; i++) {     // 1 system level
        let current_Pn_params = LOST_sorted1[i].Pn_param

        let tilt_array = []
        let x_y_array = []
        let sin_cos_array = []
        for (let j = 0; j < current_Pn_params.length; j++) {     // 1 parameter level
            let tilt = (360 / current_Pn_params.length) * j
            tilt_array.push(tilt + 90)  // making it start from top
            let tiltInRadians = tilt * (Math.PI / 180);
            let stickLength = current_Pn_params[j] * 50
            let sin_in_percent = Math.round(Math.sin(tiltInRadians) * stickLength * 100) / 100 // horizontal
            let cos_in_percent = Math.round(Math.cos(tiltInRadians) * stickLength * 100) / 100 // vertical
            let sin_cos = []
            sin_cos.push(sin_in_percent)
            sin_cos.push(cos_in_percent)
            sin_cos_array.push(sin_cos)
            let x_y = []
            let x_coord = 50 + sin_in_percent
            let y_coord = 50 + cos_in_percent
            x_y.push(x_coord)
            x_y.push(y_coord)
            x_y_array.push(x_y)
        }
        // make a str polygon function
        let polygonFormula = "clip-path: polygon("
        for (let i = 0; i < x_y_array.length; i++) {
            polygonFormula = polygonFormula + x_y_array[i][0] + "% " + x_y_array[i][1] + "%, "
        }
        polygonFormula = polygonFormula.slice(0, -2)
        polygonFormula = polygonFormula + ")"

        LOST_sorted1[i].tiltArray = tilt_array
        LOST_sorted1[i].polygon = polygonFormula
    }
    res.render('result', {
        title: 'Результати',
        systems: LOST_sorted1, chosenCheck: req.session.chosenCheck,
        name_of_each_vertex: req.session.name_of_each_vertex
    });
});


// Роутер для обробки реєстрації
app.post('/register/user', async (req, res) => {
    try {
        let {first_name, second_name, email, password} = req.body;
        email = email.toLowerCase();
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


// Роутер для обробки авторизації
app.post('/login/user', async (req, res) => {
    try {
        let {email, password} = req.body;
        email = email.toLowerCase();
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


app.get('/edit-category/:id', authenticateUser, async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Отримуємо категорію за її ID
        const category = await Category.findById(categoryId);
        const selectors = await TypeOfResource.find();

        // Передаємо дані категорії до шаблону для відображення у формі
        return res.render('Admin/edit-category.twig', {category, selectors});
    } catch (error) {
        console.error('Error during category editing:', error);
        return res.send('<script>alert("Виникла помилка під час редагування категорії"); window.history.back();</script>');
    }
});


app.post('/edit-category/:id', authenticateUser, async (req, res) => {
    try {
        const categoryId = req.params.id;
        let author = req.session.user.email
        const {
            title,
            type,
            filter1,
            filter2,
            filter3,
            filter4,
            filter5,
            filter6,
            filter7,
            filter8,
            filter9,
            filter10
        } = req.body;

        // Оновлення назви та типу категорії
        await Category.findByIdAndUpdate(categoryId, {
            $pull: {userMarks: {author: author}}
        })

        await Category.findByIdAndUpdate(categoryId, {
            title: title,
            type: type,
            evaluated: true,
            $addToSet: {evaluatedBy: author},
            $push: {
                userMarks: {
                    author: author,
                    marks: [
                        {
                            title: 'Інтерактивність',
                            rating: filter1
                        },
                        {
                            title: 'Мультимедійність',
                            rating: filter2
                        },
                        {
                            title: 'Можливість модифікації',
                            rating: filter3
                        },
                        {
                            title: 'Кросплатформеність',
                            rating: filter4
                        },
                        {
                            title: 'Вільнопоширюваність',
                            rating: filter5
                        },
                        {
                            title: 'Архітектура',
                            rating: filter6
                        },
                        {
                            title: 'Функціональність',
                            rating: filter7
                        },
                        {
                            title: 'Чисельність тем для опрацювання',
                            rating: filter8
                        },
                        {
                            title: 'Відповідність предметній області',
                            rating: filter9
                        },
                        {
                            title: 'Відповідність навчального змісту освітнім стандартам',
                            rating: filter10
                        }]
                }
            }
        });

        // this code finds avarage and applies it for parameters of the system 1 by 1
        const oneSystem = await Category.findById(categoryId)
        for (let j = 0; j < 10; j++){
            let oneParamForAllUsers = []
            for (let i = 0; i < oneSystem.userMarks.length; i++){
                let result = oneSystem.userMarks[i].marks[j].rating
                result = parseInt(result)
                oneParamForAllUsers.push(result)
            }

            let sum = 0
            for (let n = 0; n < oneParamForAllUsers.length; n++){
                sum += oneParamForAllUsers[n]
            }
            let average = sum/oneParamForAllUsers.length

            await Category.updateOne(
                {_id: categoryId},
                {$set: {[`params.${j}.rating`]: average}})
        }

        return res.send('<script>alert("Категорія успішно оновлена"); window.location.href = "/admin/panel";</script>');
    } catch (error) {
        console.error('Error during category update:', error);
        return res.send('<script>alert("Виникла помилка під час оновлення категорії"); window.history.back();</script>');
    }
});

app.post("/apply-resource", async (req, res) => {
    try {
        // Отримуємо вибрані типи ресурсів з тіла запиту
        let bulkData = req.body
        let chosenType_of_resource = bulkData.type_of_resource
        let chosenImportance = bulkData.importance
        let chosenCheck = bulkData.check

        //put numbers only into chosenImportance
        for (let i = 0; i < chosenImportance.length; i++) {
            chosenImportance[i] = parseInt(chosenImportance[i])
        }

        //put numbers only into chosenCheck
        let name_of_each_vertex = []
        for (let i = 0; i < chosenCheck.length; i++) {
            name_of_each_vertex[i] = chosenCheck[i].slice(0, -2)
            chosenCheck[i] = parseInt(chosenCheck[i].slice(-1))
        }
        req.session.chosenCheck = chosenCheck
        req.session.name_of_each_vertex = name_of_each_vertex
        const LOST = await Category.find({type: chosenType_of_resource});
        if (chosenCheck.length < 3){
            return res.status(500).send('<script>alert("Необхідно обрати хоча б 2 критерія!"); window.history.back();</script>');
        }
        //working names
        // LOST = list of Systems That Fits the criteria

        // STEP1 - COMPUTING THE PULL OF MATRIX
        // this is 3-dimensional matrix in format: matrix3d_forAGn[pick AGn from 0 to 9][pick a row for selected matrix][pick index]
        //    matrix3d_forAGn[AGn][h][i]
        const matrix3d_forAGn = []
        for (let AGn = 0; AGn < 10; AGn++) {
            let matrix = []
            for (let i = 0; i < LOST.length; i++) {
                let line = []
                for (let h = 0; h < LOST.length; h++) {
                    let result
                    let h_rating = LOST[h].params[AGn].rating
                    let i_rating = LOST[i].params[AGn].rating
                    if (i_rating === h_rating) {
                        result = 1
                    } else if (i_rating > h_rating) {
                        result = i_rating - h_rating
                    } else {
                        result = 1 / (h_rating - i_rating)
                    }
                    line.push(result)
                }
                matrix.push(line)
            }
            matrix3d_forAGn.push(matrix)
        }

        //STEP - PICK CHOSEN PARAMS FROM matrix3d_forAGn AND PUT THEM INSIDE NEW MATRIX
        let matrix3d_forAGn_filtered = []
        for (let i = 0; i < chosenCheck.length; i++) {
            let matrix_element = matrix3d_forAGn[chosenCheck[i]]
            matrix3d_forAGn_filtered.push(matrix_element)
        }

        // STEP - FINDING AN INVERTED SUM OF COLUMNS AND PUTTING IT INTO THE ARRAY
        let Gn_matrix = []
        for (let Gn = 0; Gn < matrix3d_forAGn_filtered.length; Gn++) {
            let Gn_line = []
            for (let i = 0; i < LOST.length; i++) {
                let result = 0
                for (let h = 0; h < LOST.length; h++) {
                    result += matrix3d_forAGn_filtered[Gn][h][i]
                }
                let inverted_result = 1 / result
                Gn_line.push(inverted_result)
            }
            Gn_matrix.push(Gn_line)
        }

        // STEP - PICK ONLY CHOSEN PARAMS FOR WEIGHTS IN ORDER TO BUILD A-MATRIX
        let chosenImportance_filtered = []
        for (let i = 0; i < chosenCheck.length; i++) {
            let element = chosenImportance[chosenCheck[i]]
            chosenImportance_filtered.push(element)
        }

        // STEP - EVALUATE THE WEIGHT OF EACH PARAMETER
        let weight_matrix = []
        for (let i = 0; i < chosenCheck.length; i++) {
            let line = []
            for (let h = 0; h < chosenCheck.length; h++) {
                let result
                if (chosenImportance_filtered[i] === chosenImportance_filtered[h]) {
                    result = 1
                } else if (chosenImportance_filtered[i] > chosenImportance_filtered[h]) {
                    result = chosenImportance_filtered[i] - chosenImportance_filtered[h]
                } else {
                    result = 1 / (chosenImportance_filtered[h] - chosenImportance_filtered[i])
                }
                line.push(result)
            }
            weight_matrix.push(line)
        }

        // STEP - FINDING AN INVERTED SUM OF COLUMNS AND PUTTING IT INTO THE ARRAY (for weights)
        let power_coefficient_line = []
        for (let i = 0; i < chosenCheck.length; i++) {
            let power_coefficient_value = 0
            for (let h = 0; h < chosenCheck.length; h++) {
                power_coefficient_value += weight_matrix[h][i]
            }
            let inverted_result = 1 / power_coefficient_value
            power_coefficient_line.push(inverted_result)
        }
        console.log(power_coefficient_line)

        //STEP - APPLY POWERS TO Gn
        let Gn_matrix_with_powers = []
        for (let h = 0; h < Gn_matrix.length; h++) {
            let Gn_line_with_powers = []
            for (let i = 0; i < Gn_matrix[0].length; i++) {
                let exponentiation_value = Gn_matrix[h][i] ** power_coefficient_line[h]
                Gn_line_with_powers.push(exponentiation_value)
            }
            Gn_matrix_with_powers.push(Gn_line_with_powers)
        }

        //STEP - DECLARE Pn - PARAMETERS FOR EVERY SYSTEM
        let Pn_matrix = []
        for (let i = 0; i < Gn_matrix_with_powers[0].length; i++) {
            let Pn_line = []
            for (let h = 0; h < Gn_matrix_with_powers.length; h++) {
                let value = Gn_matrix_with_powers[h][i]
                Pn_line.push(value)
            }
            Pn_matrix.push(Pn_line)
        }

        // STEP - FIND MINIMUM FOR Pn => create D_line
        let D_line = []
        for (let h = 0; h < Pn_matrix.length; h++) {
            let result = Math.min(...Pn_matrix[h])
            D_line.push(result)
        }

        // STEP - PUT SYSTEMS IN THE RIGHT ORDER
        let D_line_sorted = [...D_line]

        let LOST_sorted = []
        D_line_sorted.sort((a, b) => b - a)
        let winners_index = []
        for (let i = 0; i < D_line.length; i++) {
            const index = D_line.indexOf(D_line_sorted[i])
            D_line[index] = 0
            winners_index.push(index)
            // req.session.LOST_sorted.push(LOST[index])
            LOST_sorted.push(LOST[index])
        }

        // STEP - sorting P parameters in order to match winners
        let Pn_matrix_sorted = []
        for (let i = 0; i < winners_index.length; i++) {
            let num = winners_index[i]
            let line = Pn_matrix[num]
            Pn_matrix_sorted.push(line)
            LOST_sorted[i]._doc.Pn_param = line
        }

        req.session.LOST_sorted = LOST_sorted
        res.redirect('/result')
    } catch (error) {
        console.error('Error during applying resource:', error);
        return res.status(500).send(
            '<script>alert("Ви не обрали критерії!"); window.history.back();</script>'
        );
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
