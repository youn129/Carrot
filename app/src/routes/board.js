const router = require('express').Router()

let connectDB = require('../../database.js');

let db;
connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
});

function checkLogin(요청, 응답, next) {
    if (!요청.user) {
        return 응답.send('로그인하세요')
    }
    next()
};



router.get('/sports', checkLogin, (요청, 응답) => {
    응답.send('스포츠 게시판')
})
router.get('/game', checkLogin, (요청, 응답) => {
    응답.send('게임 게시판')
}) 

 module.exports = router