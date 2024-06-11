const router = require('express').Router();
const { ObjectId } = require('mongodb');
let connectDB = require('./../database.js');

let db;
connectDB.then((client)=>{
  
  db = client.db('forum')
}).catch((err)=>{
  console.log(err)
});

function 로그인 (요청, 응답, next) {
    if (!요청.user) {
        return 응답.send('로그인하세요')
    }
    next()
};


router.get('/request', async (요청, 응답) => {
    await db.collection('chatroom').insertOne({
        member : [요청.user.id, new ObjectId(요청.query.writerId)],
        date : new Date()
    })
    응답.redirect('/chat/list')
})

router.get('/list', async (req, res) => {
    try {
        const userId = req.user.id;

        // 로그인한 사용자가 속한 채팅방들을 가져옴
        let chatrooms = await db.collection('chatroom').find({
            member: userId
        }).toArray();

        // 중복된 채팅방을 필터링하여 제거
        chatrooms = chatrooms.reduce((uniqueChatrooms, chatroom) => {
            // 채팅방의 구성원이 [userId, partnerId] 형태로 저장되어 있으므로
            // 정렬하여 문자열로 변환한 후 중복을 체크함
            const sortedMembers = chatroom.member.sort().join(',');
            const isDuplicate = uniqueChatrooms.some(room => {
                const sortedRoomMembers = room.member.sort().join(',');
                return sortedRoomMembers === sortedMembers;
            });

            if (!isDuplicate) {
                uniqueChatrooms.push(chatroom);
            }

            return uniqueChatrooms;
        }, []);

        res.render('chatList.ejs', { result: chatrooms, userId: userId });
    } catch (error) {
        console.error('채팅방 목록을 불러오는 동안 오류가 발생했습니다:', error);
        res.status(500).send('서버 오류 발생');
    }
});

// app.get('/chat/detail', async (요청, 응답) => {
    
//     응답.render('chatDetail.ejs')
// })

router.get('/detail/:id', 로그인, async (요청, 응답) => {
    try {
        const roomId = new ObjectId(요청.params.id);
        const userId = 요청.user.id;
        const senderId = 요청.user.id; // 세션에서 senderId 가져오기

        let result = await db.collection('chatroom').findOne({ _id : roomId });

        if (result) {
            let messages = await db.collection('message').find({ documentId : 요청.params.id }).toArray();
            messages = messages.map(message => {
                if (!Array.isArray(message.senderId)) {
                    message.senderId = [message.senderId];
                }
                return message;
            });
            messages.senderId = senderId; // 클라이언트로부터 전달된 senderId 대신 세션에서 가져온 senderId 사용
            
            응답.render('chatDetail.ejs', { result: result, messages: messages, userId: userId, partnerId: 요청.query.partner, senderId: senderId });
        } else {
            console.log('채팅방을 찾을 수 없습니다.');
            // 채팅방을 찾을 수 없는 경우에 대한 처리
        }
    } catch (error) {
        console.error('채팅방 ID를 ObjectId로 변환하거나 메시지를 가져오는 동안 오류가 발생했습니다:', error);
        // 오류 처리
    }
});

module.exports = router;