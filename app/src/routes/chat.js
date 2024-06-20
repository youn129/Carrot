const router = require('express').Router();
const { ObjectId } = require('mongodb');
const connectDB = require('./../database.js');

let db;

connectDB.then((client) => {
    db = client.db('forum');
}).catch((err) => {
    console.log(err);
});

function 로그인(요청, 응답, next) {
    if (!요청.user) {
        return 응답.send('로그인하세요');
    }
    next();
}

router.get('/request', async (요청, 응답) => {
    try {
        if (요청.user) {
            const userId = 요청.user.id;
            const writerId = 요청.user.writerId;

            const 채팅방확인 = await db.collection('chatroom').findOne({
                member: { $all: [userId, new ObjectId(writerId)] }
            });

            if (!채팅방확인) {
                await db.collection('chatroom').insertOne({
                    member: [userId, new ObjectId(writerId)],
                    date: new Date()
                });
            }
        }
        응답.redirect('/chat/list');
    } catch (e) {
        console.log(e);
        응답.status(404).send('로그인해야 가능해요!');
    }
});

router.get('/list', async (req, res) => {
    try {
        const userId = req.user.id;

        let chatrooms = await db.collection('chatroom').find({
            member: userId
        }).toArray();

        chatrooms = chatrooms.reduce((uniqueChatrooms, chatroom) => {
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

        const memberIds = chatrooms.flatMap(chatroom => chatroom.member);
        const uniqueMemberIds = [...new Set(memberIds)];
        const members = await db.collection('user').find({
            _id: { $in: uniqueMemberIds.map(id => new ObjectId(id)) }
        }).toArray();
        const memberMap = {};
        members.forEach(member => {
            memberMap[member._id.toString()] = member.username;
        });

        chatrooms = chatrooms.map(chatroom => {
            chatroom.memberNames = chatroom.member.map(id => memberMap[id.toString()]);
            return chatroom;
        });

        // userId를 템플릿에 전달하여 nav.ejs에서 사용할 수 있도록 함
        res.render('chatList.ejs', { result: chatrooms, userId: userId });
    } catch (error) {
        console.error('채팅방 목록을 불러오는 동안 오류가 발생했습니다:', error);
        res.status(500).send('서버 오류 발생, 로그인하셨나요?');
    }
});

router.get('/detail/:id', 로그인, async (요청, 응답) => {
    try {
        const roomId = new ObjectId(요청.params.id);
        const userId = 요청.user.id;
        const senderId = 요청.user.id;

        let result = await db.collection('chatroom').findOne({ _id: roomId });

        if (result) {
            let messages = await db.collection('message').find({ documentId: 요청.params.id }).toArray();
            messages = messages.map(message => {
                if (!Array.isArray(message.senderId)) {
                    message.senderId = [message.senderId];
                }
                return message;
            });
            messages.senderId = senderId;

            응답.render('chatDetail.ejs', { result: result, messages: messages, userId: userId, partnerId: 요청.query.partner, senderId: senderId });
        } else {
            console.log('채팅방을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('채팅방 ID를 ObjectId로 변환하거나 메시지를 가져오는 동안 오류가 발생했습니다:', error);
    }
});

router.post('/delete/:id', 로그인, async (req, res) => {
    try {
        const roomId = new ObjectId(req.params.id);
        const userId = req.body.userId;

        console.log("Received userId:", userId);

        const chatroom = await db.collection('chatroom').findOne({ _id: roomId });
        console.log("Found chatroom:", chatroom);

        // chatroom.member의 ObjectId를 문자열로 변환하여 비교
        const memberIds = chatroom.member.map(id => id.toString());
        console.log("Member IDs:", memberIds);

        if (chatroom && memberIds.includes(userId)) {
            await db.collection('chatroom').deleteOne({ _id: roomId });
            await db.collection('message').deleteMany({ documentId: req.params.id });
            res.redirect('/chat/list');
        } else {
            res.status(403).send('삭제 권한이 없습니다.');
        }
    } catch (error) {
        console.error('채팅방 삭제 중 오류가 발생했습니다:', error);
        res.status(500).send('서버 오류 발생, 삭제할 수 없습니다.');
    }
});

module.exports = router;
