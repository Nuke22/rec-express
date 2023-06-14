const express = require('express');
const router = express.Router();

//TODO Сторінка Домашня
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Домашня сторінка' });
});
//TODO Сторінка Реєстрації
router.get('/register', function(req, res, next) {
  res.render('Auth/register',{title:'Реєстрація'});
});
// TODO Сторінка Адмін Панелі
router.get('/admin-panel', function(req, res, next) {
    res.render('Admin/admin-panel',{title:'Панель Адміністратора'});
});
//TODO Сторінка Пошуку
router.get('/search', function(req, res, next) {
    res.render('User/search',{title:'Пошук'});
});
//TODO Сторінка Результатів
router.get('/result', function(req, res, next) {
    res.render('User/result',{title:'Результати'});
});
module.exports = router;
