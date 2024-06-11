const router = require('express').Router();
const { ObjectId } = require('mongodb');
const upload = require('./../upload.js');
let connectDB = require('./../database.js');

let db;
connectDB.then((client)=>{
  
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
});


router.get('/:id', async (요청, 응답) => {
    
    let result = await db.collection('post').findOne({ _id : new ObjectId(요청.params.id) })
    console.log(result)
    응답.render('edit.ejs', { result : result})
});

router.put('/:id', upload.array('img1'), async (요청, 응답) => {

    try {
        if (요청.body.title == '') {
            응답.status(404).send('수정할 제목이 비워졌어요')
        }
        else if (요청.body.content == '') {
            응답.status(404).send('수정할 내용이 비워졌어요')
        }
        else if (!요청.user || !요청.user.id) {
            응답.status(404).send('로그인이 필요합니다')
        }
        else {
            const 게시글 = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id) });
            if (!게시글 || String(게시글.user) !== String(요청.user.id)) {
                응답.status(404).send('다른 유저의 게시글은 수정할 수 없어요')
            } else {
                const imgUrls = 요청.files.map(file => file.location); // 수정된 이미지 URL 가져오기
                const result = await db.collection('post').updateOne({ 
                    _id : new ObjectId(요청.params.id),
                    user: new ObjectId(요청.user.id) }, 
                    {$set : { title : 요청.body.title, content : 요청.body.content, img : imgUrls} }); // 이미지 URL 업데이트
                console.log(result);
                응답.redirect('/list');
            }
        } 
    }
    catch (e) {
        console.log(e);
        응답.status(404).send('잘못된 주소입니다');
    }
    
});

module.exports = router