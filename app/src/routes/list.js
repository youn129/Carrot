const router = require('express').Router();
const { ObjectId } = require('mongodb');
let connectDB = require('../../database.js');

let db;
connectDB.then((client)=>{
  
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
});

// 페이지 처리 함수
const renderList = async (요청, 응답, currentPage) => {
    try {
        const perPage = 10;
        const skip = (currentPage - 1) * perPage;
        const posts = await db.collection('post').find().sort({ _id: -1 }).skip(skip).limit(perPage).toArray();
        const totalPosts = await db.collection('post').countDocuments();
        const totalPages = Math.ceil(totalPosts / perPage);
        const maxPagesToShow = 5; // 한 번에 보여줄 최대 페이지 수

        let startPage = 1;
        let endPage = totalPages;

        if (totalPages > maxPagesToShow) {
            const halfMaxPagesToShow = Math.floor(maxPagesToShow / 2);
            if (currentPage > halfMaxPagesToShow) {
                startPage = currentPage - halfMaxPagesToShow;
                endPage = currentPage + halfMaxPagesToShow - 1;
                if (endPage > totalPages) {
                    endPage = totalPages;
                }
            } else {
                endPage = maxPagesToShow;
            }
        }

        let userPosts = [];
        if (요청.user) {
         userPosts = await db.collection('post').find({ user: new ObjectId(요청.user.id) }).toArray();
        }

        응답.render('list.ejs', {
            글목록: posts,
            현재페이지: currentPage,
            총페이지: totalPages,
            시작페이지: startPage,
            끝페이지: endPage,
            유저게시물: userPosts
        });
    } catch (error) {
        console.error('게시물 조회 중 오류 발생:', error);
        응답.status(500).send('로그인하세요');
    }
};

// 첫 번째 페이지를 처리하는 라우트
router.get('/', async (요청, 응답) => {
    await renderList(요청, 응답, 1);
});

// 페이지를 처리하는 라우트
router.get('/:page', async (요청, 응답) => {
    const currentPage = parseInt(요청.params.page || 1);
    await renderList(요청, 응답, currentPage);
});

module.exports = router;
