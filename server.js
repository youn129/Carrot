const express = require('express');
const app = express();
const { MongoClient, ObjectId } = require('mongodb');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');

const { createServer } = require('http');
const { Server } = require('socket.io');
const server = createServer(app);
const io = new Server(server); 

require('dotenv').config();

app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({extended:true}));

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
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

let connectDB = require('./database.js');

let db;
let changeStream;
connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum');

  let 조건 = [
    { $match : { operationType : 'insert' } }
    ]
    changeStream = db.collection('post').watch(조건)

  server.listen(process.env.PORT, () => {
    console.log('http://localhost8080 에서 서버 실행중')
    });
}).catch((err)=>{
  console.log(err)
});


function 로그인 (요청, 응답, next) {
    if (!요청.user) {
        return 응답.send('로그인하세요')
    }
    next()
};

function 아이디비번체크 (요청, 응답, next) {
    if (요청.body.username == '' || 요청.body.password == '') {
      응답.send('그러지마세요')
    } else {
      next()
    }
} 

app.get('/', (요청, 응답) => {
    응답.render('index.ejs')
});


app.get('/about', (요청, 응답) => {
    응답.sendFile(__dirname + '/about.html')
});


app.get('/time', async (요청, 응답) => {
    응답.render('time.ejs', { data : new Date() })
})



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
    let result = await db.collection('user').findOne({ username : 입력한아이디})
    if (!result) {
      return cb(null, false, { message: '아이디 DB에 없음' })
    }

    if (await bcrypt.compare(입력한비번, result.password)) {
      return cb(null, result)
    } else {
      return cb(null, false, { message: '비번불일치' });
    }
}));

passport.serializeUser((user, done) => {
    process.nextTick(() => {
      done(null, { id: user._id, username: user.username })
    })
  });

passport.deserializeUser(async (user, done) => {
    let result = await db.collection('user').findOne({_id : new ObjectId(user.id)})
    const userObject = { id: result._id, username: result.username };
    process.nextTick(() => {
        done(null, userObject);
    });
  });



app.get('/login', async (요청,응답) => {
    console.log(요청.user)
    응답.render('login.ejs')
});

app.post('/login', 아이디비번체크, async (요청, 응답, next) => {
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



app.get('/detail/:id', async (요청, 응답) => {
    console.log(요청.user.username)
    try {
        let result2 = await db.collection('comment').find( { parentId : new ObjectId(요청.params.id) } ).toArray()
        let result = await db.collection('post').findOne({ _id : new ObjectId(요청.params.id) })
        if (result == null) {
            응답.status(404).send('존재하지 않는 게시물입니다. 주소가 맞는지 다시 한번 확인해주세요.')
        }
        응답.render('detail.ejs', { result : result, result2 : result2, 유저 : 요청.user.username })
    }
    catch (e) {
        console.log(e)
        응답.status(404).send('잘못된 주소입니다')
    }
});



app.get('/mypage', async (요청, 응답, next) => {
    let 회원아이디 = 요청.user
    console.log(회원아이디)
    if (회원아이디) {
        응답.render('mypage.ejs', {회원아이디 : 회원아이디})
    }
    else {
        응답.send('로그인 안했는데요')
    }
    
})

app.get('/write', 로그인, async (요청,응답) => {
    응답.render('write.ejs')
})

app.get('/search', async (요청,응답) => {
    console.log(요청.query.val)
    let 검색조건 = [
        {$search : {
          index : 'title_index',
          text : { query : 요청.query.val, path : 'title' }
        }},
        { $limit : 5 },
        
      ]
    let result = await db.collection('post').aggregate(검색조건).toArray()
    응답.render('search.ejs', { 글목록 : result })
})



app.post('/newpost', upload.array('img1'), async (요청, 응답)=> {
    
    try {
        if (요청.files.length > 8) {
            return 응답.status(400).send('이미지는 최대 7개까지 업로드할 수 있습니다.');
        }
        if (요청.body.title == '') {
            응답.send('제목을 입력하세요')
        }
        else if (요청.body.content == '') {
            응답.send('내용을 입력하세요')
        }
        else {
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
    }
    catch (e) {
        console.log(e)
        응답.status(500).send('서버 에러')
    }
} );

app.post('/comment', 로그인, async (요청, 응답) => {
    console.log(요청.user)
    
    await db.collection('post').findOne(new ObjectId)
    await db.collection('comment').insertOne({
        content : 요청.body.content,
        writerId : new ObjectId(요청.user.id),
        writer : 요청.user.username,
        parentId : new ObjectId(요청.body.parentId)
    })
    응답.redirect('back')
});







io.on('connection', (socket)=> {
    // 이 부분에서 socket.request.session.passport.user.id를 이용하여 senderId를 설정합니다.
    const senderId = socket.handshake.session.passport.user.id;

    socket.on('ask-join', (data)=>{
        // socket.request.session
        socket.join(data)
    });

    // 클라이언트로부터 이전 메시지 요청을 받는 핸들러
    socket.on('request-previous-messages', async (roomId) => {
        try {
            const messages = await db.collection('message').find({ documentId: roomId }).toArray();
            socket.emit('previous-messages', messages);
        } catch (error) {
            console.error('이전 메시지를 가져오는 동안 오류가 발생했습니다:', error);
        }
    });

    socket.on('message-send', async (data)=>{
        console.log(data);
        try {
            const roomId = new ObjectId(data.room);
            // 채팅방의 _id를 사용하여 채팅방을 찾음
            let result = await db.collection('chatroom').findOne({ _id : roomId });
            if(result) {
                const chatId = result.member; 
                await db.collection('message').insertOne({
                    chatContent : data.msg,
                    date : new Date(),
                    chatId : chatId,
                    documentId : data.room,
                    senderId: senderId 
                });
                // 해당 채팅방의 멤버에게만 메시지를 전송
                chatId.forEach(memberId => {
                    io.to(memberId).emit('message-broadcast', { 
                        chatContent: data.msg, 
                        chatId: chatId, 
                        senderId: senderId
                    }); // 채팅 아이디 전송
                });
                

                // 이전 메시지를 가져오는 로직
                const messages = await db.collection('message').find({ documentId: data.room }).toArray();
                // 클라이언트로 메시지 전송
                io.to(data.room).emit('previous-messages', messages);
            } else {
                console.log('채팅방을 찾을 수 없습니다.');
            }
        } catch (error) {
            console.error('채팅방 ID를 ObjectId로 변환하는 동안 오류가 발생했습니다:', error);
        }
    });
});

app.get('/stream/list', (요청, 응답)=>{
    응답.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    })
    

        changeStream.on('change', (result)=>{
            console.log(result.fullDocument)
            응답.write('event: msg\n');
            응답.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`);
        })
})




app.use('/shop', require('./routes/shop.js'));

app.use('/board/sub', require('./routes/board.js'));

app.use('/edit', require('./routes/edit.js'));

app.use('/list', require('./routes/list.js'));

app.use('/register', require('./routes/register.js'));

app.use('/chat', require('./routes/chat.js'));






