const express = require('express');
const axios = require('axios'); // axios 모듈 추가
const app = express();
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
const { createServer } = require('http');
const { Server } = require('socket.io');
const server = createServer(app);
const io = new Server(server);

const { router: getRealEstateDataRouter } = require('./src/routes/getRealEstateData.js');
const seoulDistrictCodes = require('./src/data/seoulDistrictCodes.js');

require('dotenv').config();

app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/getRealEstateData', getRealEstateDataRouter);


const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const MongoStore = require('connect-mongo');

const sessionMiddleware = session({
    secret: process.env.DB_PW,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 },
    store: MongoStore.create({
        mongoUrl: process.env.DB_URL,
        dbName: 'forum'
    })
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

const sharedSession = require('express-socket.io-session');
io.use(sharedSession(sessionMiddleware, {
    autoSave: true
}));

const upload = require('./upload.js');
const connectDBPromise = require('./database.js'); // 변경: 프로미스를 반환하는 방식으로 수정

let db;
let postListener;
let chatListener;

connectDBPromise.then((client) => {
    db = client.db('forum');
    server.listen(process.env.PORT, () => {
        console.log('서버가 포트 ' + process.env.PORT + '에서 실행 중입니다.');
    });

    const postStream = [{ $match: { operationType: 'insert' } }];
    const chatStream = [{ $match: { operationType: 'insert' } }];

    // 게시글 리스너 등록
    if (!postListener) {
        postListener = db.collection('post').watch(postStream);
        postListener.on('change', (change) => {
            console.log('게시글 change event:', change.fullDocument);
            io.emit('postChange', change.fullDocument);
        });
    }

    // 채팅 리스너 등록
    if (!chatListener) {
        chatListener = db.collection('message').watch(chatStream);
        chatListener.on('change', async (change) => {
            console.log('채팅 change event:', change.fullDocument);
            // 변경 이벤트가 발생한 메시지를 전송한 사용자 ID를 제외하고 이벤트 전송
            sendEvent('chatChange', change.fullDocument, change.fullDocument.senderId);
        });
    }
}).catch((err) => {
    console.error('DB 연결 오류:', err);
});


if (process.env.NODE_ENV === 'development') {
    console.log('현재는 개발 환경입니다.');
}

function 로그인(요청, 응답, next) {
    if (!요청.user) {
        return 응답.send('로그인하세요');
    }
    next();
}

function 아이디비번체크(요청, 응답, next) {
    if (요청.body.username == '' || 요청.body.password == '') {
        응답.send('그러지마세요');
    } else {
        next();
    }
}


app.get('/', (요청, 응답) => {
    응답.render('index.ejs', { seoulDistrictCodes });
});

// app.get('/detailRealEstate', (요청, 응답) => {
//     응답.render('detailRealEstate.ejs');
// });

app.get('/about', (요청, 응답) => {
    응답.sendFile(__dirname + '/about.html');
});

app.get('/time', async (요청, 응답) => {
    응답.render('time.ejs', { data: new Date() });
});

app.delete('/doc', async (요청, 응답) => {
    try {
        await db.collection('post').deleteOne({
            _id: new ObjectId(요청.query.docid),
            user: new ObjectId(요청.user.id)
        });
        응답.status(200).json({ message: '삭제가 완료되었습니다.' });
    } catch (error) {
        console.error('삭제 중 오류 발생:', error);
        응답.status(500).json({ error: '삭제 중 오류가 발생했습니다.' });
    }
});

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    let result = await db.collection('user').findOne({ username: 입력한아이디 });
    if (!result) {
        return cb(null, false, { message: '아이디 DB에 없음' });
    }

    if (await bcrypt.compare(입력한비번, result.password)) {
        return cb(null, result);
    } else {
        return cb(null, false, { message: '비번불일치' });
    }
}));

passport.serializeUser((user, done) => {
    process.nextTick(() => {
        done(null, { id: user._id, username: user.username });
    });
});

passport.deserializeUser(async (user, done) => {
    let result = await db.collection('user').findOne({ _id: new ObjectId(user.id) });
    const userObject = { id: result._id, username: result.username };
    process.nextTick(() => {
        done(null, userObject);
    });
});

app.get('/logout', (요청, 응답) => {
    요청.logout((err) => {
        if (err) { return next(err); }
        요청.session.destroy((err) => {
            if (err) {
                console.log(err);
                return 응답.send('로그아웃 중 에러 발생');
            }
            응답.redirect('/');
        });
    });
});

app.get('/detail/:id', async (요청, 응답) => {
    // console.log(요청.user.username)
    try {
        let result2 = await db.collection('comment').find({ parentId: new ObjectId(요청.params.id) }).toArray();
        let result = await db.collection('post').findOne({ _id: new ObjectId(요청.params.id) });
        if (result == null) {
            응답.status(404).send('존재하지 않는 게시물입니다. 주소가 맞는지 다시 한번 확인해주세요.');
        }

        let 유저 = 요청.user ? 요청.user.username : undefined;

        응답.render('detail.ejs', { result: result, result2: result2, 유저: 유저 });
    }
    catch (e) {
        console.log(e);
        응답.status(404).send('잘못된 주소입니다');
    }
});



app.get('/mypage', async (요청, 응답, next) => {
    let 회원아이디 = 요청.user;
    console.log(회원아이디);
    if (회원아이디) {
        응답.render('mypage.ejs', { 회원아이디: 회원아이디 });
    } else {
        응답.send('로그인 안했는데요');
    }
});

app.get('/write', 로그인, async (요청, 응답) => {
    응답.render('write.ejs');
});

app.get('/search', async (요청, 응답) => {
    console.log(요청.query.val);
    let 검색조건 = [
        { $search: { index: 'title_index', text: { query: 요청.query.val, path: 'title' } } },
        { $limit: 5 },
    ];
    let result = await db.collection('post').aggregate(검색조건).toArray();
    응답.render('search.ejs', { 글목록: result });
});

app.post('/newpost', upload.array('img1'), async (요청, 응답) => {
    try {
        if (요청.files.length > 8) {
            return 응답.status(400).send('이미지는 최대 7개까지 업로드할 수 있습니다.');
        }
        if (요청.body.title == '') {
            응답.send('제목을 입력하세요');
        } else if (요청.body.content == '') {
            응답.send('내용을 입력하세요');
        } else {
            const imgUrls = 요청.files.map(file => file.location);
            await db.collection('post').insertOne({
                title: 요청.body.title,
                content: 요청.body.content,
                img: imgUrls, // S3 주소 배열 저장
                user: 요청.user.id,
                username: 요청.user.username
            });
            응답.redirect('/list');
        }
    } catch (e) {
        console.log(e);
        응답.status(500).send('서버 에러');
    }
});

app.post('/comment', 로그인, async (요청, 응답) => {
    console.log(요청.user);
    
    await db.collection('post').findOne(new ObjectId);
    await db.collection('comment').insertOne({
        content: 요청.body.content,
        writerId: new ObjectId(요청.user.id),
        writer: 요청.user.username,
        parentId: new ObjectId(요청.body.parentId)
    });
    응답.redirect('back');
});

io.on('connection', (socket) => {
    if (socket.handshake.session.passport && socket.handshake.session.passport.user) {
        socket.userId = socket.handshake.session.passport.user.id;
    }

    socket.on('ask-join', (data) => {
        socket.join(data);
    });

    socket.on('request-previous-messages', async (roomId) => {
        try {
            const messages = await db.collection('message').find({ documentId: roomId }).toArray();
            socket.emit('previous-messages', messages);
        } catch (error) {
            console.error('이전 메시지를 가져오는 동안 오류가 발생했습니다:', error);
        }
    });

    socket.on('message-send', async (data) => {
        try {
            const roomId = new ObjectId(data.room);
            let result = await db.collection('chatroom').findOne({ _id: roomId });
            if (result) {
                const chatId = result.member;
                const message = {
                    chatContent: data.msg,
                    date: new Date(),
                    chatId: chatId,
                    documentId: data.room,
                    senderId: socket.userId 
                };
                await db.collection('message').insertOne(message);

                // chatId.forEach(memberId => {
                //     io.to(memberId).emit('message-broadcast', message);
                // });
                io.to(data.room).emit('message-broadcast', message);
            } else {
                console.log('채팅방을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('채팅방 ID를 ObjectId로 변환하는 동안 오류가 발생했습니다:', error);
        }
    });

    socket.on('delete-message', async ({ messageId, roomId }) => {
        try {
            const result = await db.collection('message').updateOne(
                { _id: new ObjectId(messageId), documentId: roomId },
                { $set: { chatContent: '메시지가 삭제되었습니다.' } }
            );
            if (result.modifiedCount === 1) {
                socket.emit('message-deleted', { messageId: messageId, roomId: roomId });
            } else {
                console.log('메시지 삭제 실패');
            }
        } catch (error) {
            console.error('메시지 삭제 중 오류 발생:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('소켓 연결 종료:', socket.id);
    });
});

const sendEvent = (eventName, data, excludeUserId) => {
    io.sockets.sockets.forEach(socket => {
        if (socket.userId !== excludeUserId) {
            socket.emit(eventName, data);
        }
    });
};

app.get('/stream/list', (요청, 응답) => {
    응답.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    });

    const sendEvent = (eventName, data) => {
        응답.write(`event: ${eventName}\n`);
        응답.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    요청.on('close', () => {
        console.log('클라이언트 연결 종료');
        if (postListener) {
            postListener.removeListener('change', handlePostChange);
        }
        if (chatListener) {
            chatListener.removeListener('change', handleChatChange);
        }
        응답.end();
    });

    const handlePostChange = (change) => {
        sendEvent('postChange', change.fullDocument);
    };

    const handleChatChange = (change) => {
        sendEvent('chatChange', change.fullDocument);
    };

    if (postListener) {
        postListener.on('change', handlePostChange);
    }
    if (chatListener) {
        chatListener.on('change', handleChatChange);
    }
});

app.use('/shop', require('./src/routes/shop.js'));
app.use('/board/sub', require('./src/routes/board.js'));
app.use('/login', require('./src/routes/login.js'));
app.use('/edit', require('./src/routes/edit.js'));
app.use('/list', require('./src/routes/list.js'));
app.use('/register', require('./src/routes/register.js'));
app.use('/chat', require('./src/routes/chat.js'));
