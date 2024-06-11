const router = require('express').Router();
const bcrypt = require('bcrypt');
let connectDB = require('./../database.js');


let db;
connectDB.then((client)=>{
  
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
});

router.get('/', (요청, 응답) => {
    응답.render('register.ejs')
})

router.post('/', async (요청, 응답) => {

    let 입력아이디 = 요청.body.username;
    let 입력비번 = 요청.body.password;
    let 재입력비번 = 요청.body.password2;

    let 사용자 = await db.collection('user').findOne({ username : 입력아이디 })
    
    if (사용자) {
        // 응답.send('같은 아이디가 존재합니다');
        응답.send("<script>alert('같은 아이디가 존재합니다.');location.href='/register';</script>");
    }
    else if (입력비번 != 재입력비번) {
        응답.send("<script>alert('비밀번호가 일치하지 않습니다.');location.href='/register';</script>")
    }
    else {
        let 해시 = await bcrypt.hash(입력비번, 10)
        await db.collection('user').insertOne({ 
            username : 입력아이디, 
            password : 해시
        })
        응답.send("<script>alert('회원가입이 완료되었습니다!');location.href='/';</script>")
        }
})

module.exports = router;