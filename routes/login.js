const router = require('express').Router();
const passport = require('passport');
let connectDB = require('./../database.js');

let db;
connectDB.then((client)=>{
  
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
});


function 아이디비번체크 (요청, 응답, next) {
    if (요청.body.username == '' || 요청.body.password == '') {
      응답.send('그러지마세요')
    } else {
      next()
    }
} 


router.get('/', async (요청,응답) => {
    console.log(요청.user)
    응답.render('login.ejs')
});

router.post('/', 아이디비번체크, async (요청, 응답, next) => {
    passport.authenticate('local', (error, user, info)=>{
        if (error) {
            return 응답.status(500).json(error)
        }
        if (!user) {
            return 응답.status(401).json(info.message)
        }
        요청.logIn(user, (err)=>{
            if (err) {
                return next(err)
            }
            응답.redirect('/')
        })
    })(요청, 응답, next)
});


module.exports = router;