const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mongodb = require("mongodb");
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');


const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'twig');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);



// TODO Registration TRY
// Підключення до бази даних MongoDB
mongoose.connect('mongodb://localhost/myapp', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      console.log('Connected to MongoDB');
    })
    .catch((error) => {
      console.error('Error connecting to MongoDB:', error);
    });

// Створення моделі користувача
const User = mongoose.model('User', {
  first_name: String,
  second_name: String,
  email: String,
  password: String
});

// Middleware для обробки JSON даних
app.use(bodyParser.json());

// Роутер для обробки реєстрації
app.post('/create', async (req, res) => {
  try {
    const { first_name,second_name,email,password } = req.body;

    // Перевірка, чи користувач з таким ім'ям вже існує
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Користувач з таким ім\'ям вже існує' });
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Створення нового користувача
    const newUser = new User({ first_name,second_name,email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Реєстрація пройшла успішно' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Помилка під час реєстрації' });
  }
});

// // Запуск сервера
// app.listen(3000, () => {
//   console.log('Server started on port 3000');
// });


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
module.exports = app;
