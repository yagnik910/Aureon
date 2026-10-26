(function(){
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 3D hero ---------- */
  var sp=0;
  var cv = document.getElementById('stage'), hero = cv.parentElement;
  try{
    var R = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
    R.setPixelRatio(Math.min(devicePixelRatio,2));
    var S = new THREE.Scene(), C = new THREE.PerspectiveCamera(45,1,.1,100);
    C.position.set(0,0,9);
    S.add(new THREE.AmbientLight(0x3a4478,.9));
    var k = new THREE.PointLight(0x8b5cf6,1.6,40); k.position.set(5,4,6); S.add(k);
    var r = new THREE.PointLight(0x22d3ee,1.7,40); r.position.set(-6,-3,4); S.add(r);

    var core = new THREE.Group(); S.add(core);
    var spin = new THREE.Group(); core.add(spin);

    /* ---- morphing particle cloud: A logo -> sphere -> knot -> wave ---- */
    var N=5200, shapes=[];
    function fill(fn){var arr=new Float32Array(N*3);for(var i=0;i<N;i++){var v=fn(i);arr[i*3]=v[0];arr[i*3+1]=v[1];arr[i*3+2]=v[2]}return arr}
    // A logo sampled from a canvas
    (function(){
      var c=document.createElement('canvas');c.width=c.height=300;var g=c.getContext('2d');
      g.fillStyle='#fff';g.font='800 270px Arial,Helvetica,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('A',150,162);
      var d=g.getImageData(0,0,300,300).data,pts=[];
      for(var y=0;y<300;y+=2)for(var x=0;x<300;x+=2){if(d[(y*300+x)*4+3]>128)pts.push([x,y])}
      shapes.push(fill(function(i){var q=pts[(Math.random()*pts.length)|0]||[150,150];
        return [(q[0]-150)/300*5.6+(Math.random()-.5)*.03,-(q[1]-150)/300*5.6+(Math.random()-.5)*.03,(Math.random()-.5)*.55]}));
    })();
    // sphere (fibonacci)
    shapes.push(fill(function(i){var y=1-2*(i+.5)/N,r=Math.sqrt(1-y*y),a=i*2.399963;return [Math.cos(a)*r*2.3,y*2.3,Math.sin(a)*r*2.3]}));
    // torus knot
    shapes.push(fill(function(i){var t=Math.random()*6.2832,pq=[2,3],rr=1.35+.55*Math.cos(pq[1]*t),
      cx=rr*Math.cos(pq[0]*t)*1.35,cy=rr*Math.sin(pq[0]*t)*1.35,cz=.75*Math.sin(pq[1]*t)*1.35,
      u=Math.random()*6.2832,rad=Math.random()*.32;return [cx+Math.cos(u)*rad,cy+Math.sin(u)*rad,cz+(Math.random()-.5)*.3]}));
    // wave field
    shapes.push(fill(function(i){var gx=(i%72)/71-.5,gz=Math.floor(i/72)/Math.floor((N-1)/72)-.5,x=gx*4.8,z=gz*4.8;
      return [x,Math.sin(x*1.3)*.5+Math.cos(z*1.6)*.4,z]}));
    var tilts=[0,0,.25,-1.05];
    var pos=new Float32Array(shapes[0]),col=new Float32Array(N*3);
    var c1=new THREE.Color(0x22d3ee),c2=new THREE.Color(0x3b82f6),c3=new THREE.Color(0x8b5cf6),tc=new THREE.Color();
    for(var i=0;i<N;i++){var m=Math.random();if(m<.5)tc.copy(c1).lerp(c2,m*2);else tc.copy(c2).lerp(c3,(m-.5)*2);
      col[i*3]=tc.r;col[i*3+1]=tc.g;col[i*3+2]=tc.b}
    var pgm=new THREE.BufferGeometry();
    pgm.setAttribute('position',new THREE.BufferAttribute(pos,3));
    pgm.setAttribute('color',new THREE.BufferAttribute(col,3));
    var sc=document.createElement('canvas');sc.width=sc.height=64;var sg=sc.getContext('2d'),gr=sg.createRadialGradient(32,32,0,32,32,32);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.5)');gr.addColorStop(1,'rgba(255,255,255,0)');sg.fillStyle=gr;sg.fillRect(0,0,64,64);
    var cloud=new THREE.Points(pgm,new THREE.PointsMaterial({size:.12,map:new THREE.CanvasTexture(sc),vertexColors:true,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending}));
    spin.add(cloud);
    var cur=0,nxt=1,mp=1,holdT=-3,tilt=0;

    /* background dust */
    var DN = 380, pg = new THREE.BufferGeometry(), pp = new Float32Array(DN*3);
    for(var i=0;i<DN;i++){var a=Math.random()*6.283,b=Math.acos(2*Math.random()-1),d=4.5+Math.random()*6;
      pp[i*3]=d*Math.sin(b)*Math.cos(a);pp[i*3+1]=d*Math.sin(b)*Math.sin(a);pp[i*3+2]=d*Math.cos(b)}
    pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
    var dust = new THREE.Points(pg,new THREE.PointsMaterial({color:0xdbe7ff,size:.035,transparent:true,opacity:.6}));
    S.add(dust);

    var mx=0,my=0,tx=0,ty=0;var baseY=0,baseS=1;
    addEventListener('pointermove',function(e){mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
    function size(){var w=hero.clientWidth,h=hero.clientHeight;R.setSize(w,h,false);C.aspect=w/h;
      C.updateProjectionMatrix();
      var wide=w>900; baseY=wide?0:2.4;baseS=wide?.86:.62;core.position.set(wide?3.0:0,baseY,0);core.scale.setScalar(baseS)}
    addEventListener('resize',size); size();
    var vis=true; new IntersectionObserver(function(e){vis=e[0].isIntersecting}).observe(hero);
    var t0=performance.now(),last=t0;
    function ease(x){return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2}
    (function loop(){
      requestAnimationFrame(loop); if(!vis) return;
      var now=performance.now(),t=(now-t0)/1000,dt=Math.min((now-last)/1000,.05);last=now;
      tx+=(mx-tx)*.06; ty+=(my-ty)*.06;
      if(!reduce){
        if(mp>=1){holdT+=dt;if(holdT>3.4){holdT=0;mp=0;nxt=(cur+1)%shapes.length}}
        else{mp=Math.min(1,mp+dt/1.9);if(mp>=1)cur=nxt}
        var e=mp>=1?0:ease(mp),A=shapes[cur],B=shapes[nxt],sw=Math.sin(Math.PI*e)*.9;
        for(var i=0;i<N;i++){var j=i*3,ax=A[j],ay=A[j+1],az=A[j+2];
          var x=ax+(B[j]-ax)*e,y=ay+(B[j+1]-ay)*e,z=az+(B[j+2]-az)*e;
          if(mp<1){x+=Math.sin(t*2+i)*sw*.35;y+=Math.cos(t*2.3+i*.7)*sw*.35;z+=Math.sin(t*1.7+i*1.3)*sw*.35}
          else{var f=Math.sin(t*1.1+i*.37)*.025;x+=f;y+=f;z+=f}
          if((mp>=1?cur:nxt)===3){y+=Math.sin(x*1.3+t*1.4)*.22*(mp>=1?1:e)}
          pos[j]=x;pos[j+1]=y;pos[j+2]=z}
        pgm.attributes.position.needsUpdate=true;
        var tt=tilts[mp>=1?cur:nxt];tilt+=(tt-tilt)*.05;
        spin.rotation.x=tilt+Math.sin(t*.37)*.1;
        spin.rotation.y=((mp>=1?cur:nxt)===1||(mp>=1?cur:nxt)===2)?t*.35:Math.sin(t*.5)*.45;
        dust.rotation.y=t*.01;
      }
      core.position.y=baseY+(reduce?0:Math.sin(t*.8)*.12)+sp*1.6;core.scale.setScalar(baseS*(1-sp*.4));dust.position.y=sp*2;
      core.rotation.y=tx*1.6+sp*2.4; core.rotation.x=ty*1.1+sp*.8;
      R.render(S,C);
    })();
  }catch(e){ cv.style.display='none'; }

  /* ---------- 3D tilt cards ---------- */
  if(!reduce && matchMedia('(hover:hover)').matches){
    document.querySelectorAll('.tilt').forEach(function(el){
      el.addEventListener('pointermove',function(e){
        var b=el.getBoundingClientRect(),x=(e.clientX-b.left)/b.width,y=(e.clientY-b.top)/b.height;
        el.style.transform='rotateY('+((x-.5)*8)+'deg) rotateX('+((.5-y)*8)+'deg)';
        el.style.setProperty('--mx',x*100+'%');el.style.setProperty('--my',y*100+'%');
      });
      el.addEventListener('pointerleave',function(){el.style.transform=''});
    });
  }

  /* ---------- intro animation ---------- */
  (function(){
    var el=document.getElementById('intro'),root=document.documentElement;
    if(!el) return;
    if(reduce){root.classList.remove('intro-on');el.remove();return}
    var c=el.querySelector('canvas'),x=c.getContext('2d'),dpr=Math.min(devicePixelRatio,2),W,H;
    function rs(){W=innerWidth;H=innerHeight;c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)}
    rs();addEventListener('resize',rs);
    function cl(v){return Math.max(0,Math.min(1,v))}
    function ea(v){return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2}
    var COLS=[[34,211,238],[59,130,246],[139,92,246],[225,235,255]];
    function ringCol(u){ /* cyan -> blue -> violet along the ring */
      var A=COLS[0],B=COLS[1],C=COLS[2],k=u<.5?u*2:(u-.5)*2,f=u<.5?A:B,g=u<.5?B:C;
      return [f[0]+(g[0]-f[0])*k|0,f[1]+(g[1]-f[1])*k|0,f[2]+(g[2]-f[2])*k|0]}
    var NS=340,stars=[],i;
    function reset(s,first){s.a=Math.random()*6.2832;s.d=.04+Math.random()*.96;s.z=first?.05+Math.random()*.95:1;s.c=(Math.random()*4)|0;s.w=.6+Math.random()*1.1}
    for(i=0;i<NS;i++){var s0={};reset(s0,true);stars.push(s0)}
    var T=3.6,t0=performance.now(),last=t0,finished=false,word=el.querySelector('.word'),tag=el.querySelector('.itag'),iw=el.querySelector('.iw'),lg0=el.querySelector('.ilogo');
    function finish(){
      if(finished) return; finished=true;
      el.classList.add('done');root.classList.remove('intro-on');
      setTimeout(function(){el.remove()},1150);
    }
    (function frame(){
      if(finished) return;
      requestAnimationFrame(frame);
      var now=performance.now(),t=(now-t0)/1000,dt=Math.min((now-last)/1000,.05);last=now;
      var ir=iw.getBoundingClientRect(),cx=ir.left+ir.width/2,cy=ir.top+(lg0?lg0.offsetTop+lg0.offsetHeight/2:ir.height/2),
          RR=(lg0?lg0.offsetWidth/2:70)+20,
          e=ea(cl((t-3)/.6)),                         /* exit blast 0..1 */
          pr=ea(cl((t-.15)/1.55)),                    /* ring draw progress */
          sp=.28+1.25*Math.exp(-Math.pow((t-.85)/.65,2))+.3*Math.exp(-t*2.2)+4*e*e, /* warp speed */
          maxR=Math.hypot(W,H)*.62,R0=Math.min(W,H)*.26;
      x.globalCompositeOperation='source-over';x.clearRect(0,0,W,H);
      /* soft core glow */
      var g=x.createRadialGradient(cx,cy,0,cx,cy,RR*(2.2+e*8));
      g.addColorStop(0,'rgba(59,130,246,'+(.2*Math.min(1,t/1.2)*(1-e))+')');g.addColorStop(.5,'rgba(139,92,246,'+(.07*(1-e))+')');g.addColorStop(1,'rgba(59,130,246,0)');
      x.fillStyle=g;x.fillRect(0,0,W,H);
      x.globalCompositeOperation='lighter';x.lineCap='round';
      /* warp stars */
      for(i=0;i<NS;i++){
        var st=stars[i],vz=sp*dt*.9;
        var rn=R0*st.d/st.z,prev=R0*st.d/Math.min(1,st.z+vz*(5+sp*4));
        st.z-=vz;
        if(st.z<=.03||rn>maxR){reset(st,false);continue}
        var ca=Math.cos(st.a),sa=Math.sin(st.a),c=COLS[st.c],
            al=Math.min(1,(1-st.z)*1.6)*Math.min(1,t/.5)*(1-e*.6);
        if(rn<RR*.9&&t<2.9) al*=Math.max(0,(rn/(RR*.9)-.4))*1.7; /* keep the logo area calm */
        x.strokeStyle='rgba('+c[0]+','+c[1]+','+c[2]+','+al+')';x.lineWidth=st.w*(1+(1-st.z)*1.8);
        x.beginPath();x.moveTo(cx+ca*prev,cy+sa*prev);x.lineTo(cx+ca*rn,cy+sa*rn);x.stroke();
      }
      /* self-drawing gradient ring */
      var segs=96,n=Math.floor(segs*pr),rad=RR*(1+e*9),ra=(1-e);
      x.shadowBlur=14;
      for(i=0;i<n;i++){
        var u=i/segs,col=ringCol(u),a0=-1.5708+u*6.2832,a1=a0+6.2832/segs+.02;
        x.shadowColor='rgba('+col[0]+','+col[1]+','+col[2]+',.9)';
        x.strokeStyle='rgba('+col[0]+','+col[1]+','+col[2]+','+ra+')';x.lineWidth=3.2*(1+e*2);
        x.beginPath();x.arc(cx,cy,rad,a0,a1);x.stroke();
      }
      x.shadowBlur=0;
      if(pr<1&&pr>0){ /* glowing tip */
        var ta=-1.5708+pr*6.2832,tx=cx+Math.cos(ta)*rad,ty=cy+Math.sin(ta)*rad,tg=x.createRadialGradient(tx,ty,0,tx,ty,18);
        tg.addColorStop(0,'rgba(255,255,255,.95)');tg.addColorStop(.3,'rgba(120,200,255,.5)');tg.addColorStop(1,'rgba(120,200,255,0)');
        x.fillStyle=tg;x.beginPath();x.arc(tx,ty,18,0,6.2832);x.fill();
      }
      /* completion pulse when the ring closes */
      var pu=cl((t-1.7)/.7);
      if(pu>0&&pu<1){x.strokeStyle='rgba(120,190,255,'+(.7*(1-pu))+')';x.lineWidth=2;x.beginPath();x.arc(cx,cy,RR*(1+pu*.9),0,6.2832);x.stroke()}
      /* exit shockwave */
      if(e>0&&e<1){x.strokeStyle='rgba(180,160,255,'+(.55*(1-e))+')';x.lineWidth=2+e*6;x.beginPath();x.arc(cx,cy,RR*(1+e*14),0,6.2832);x.stroke()}
      if(t>1.9&&!word.classList.contains('on')){word.classList.add('on');var lg=el.querySelector('.ilogo');if(lg)lg.classList.add('on')}
      if(t>2.5&&!tag.classList.contains('on'))tag.classList.add('on');
      if(t>=T)finish();
    })();
  })();

  /* ---------- scroll effects ---------- */
  (function(){
    var root=document.documentElement,hero=document.getElementById('home'),hc=document.querySelector('.hero-copy'),
        state=document.querySelector('.state'),steps=document.querySelector('.steps'),nav=document.querySelector('.nav'),
        projs=[].slice.call(document.querySelectorAll('.proj')),
        links=[].slice.call(document.querySelectorAll('.nav ul a')),
        secs=links.map(function(a){return document.querySelector(a.getAttribute('href'))});
    function cl(v){return Math.max(0,Math.min(1,v))}

    /* reveal on scroll: small rise + fade, staggered, skipped for reduced motion */
    if(!reduce && 'IntersectionObserver' in window){
      root.classList.add('js');
      var els=[].slice.call(document.querySelectorAll('.head,.grid3>*,.work>*,.step,.contact>*'));
      els.forEach(function(el){
        var sib=[].slice.call(el.parentElement.children).filter(function(n){return els.indexOf(n)>-1});
        el.style.setProperty('--d',(sib.indexOf(el)%6*.09)+'s');
        el.classList.add('rv');
      });
      var io=new IntersectionObserver(function(en){
        en.forEach(function(e){
          if(!e.isIntersecting) return;
          var el=e.target; el.classList.add('in'); io.unobserve(el);
          if(el.classList.contains('step')) el.classList.add('on');
          setTimeout(function(){el.classList.remove('rv','in')},1500);
        });
      },{threshold:.15,rootMargin:'0px 0px -6% 0px'});
      els.forEach(function(el){io.observe(el)});
    }

    var tick=false;
    function upd(){
      tick=false;
      var y=scrollY,h=innerHeight,max=Math.max(1,root.scrollHeight-h);
      root.style.setProperty('--sp',(y/max).toFixed(4));
      nav.classList.toggle('sc',y>30);
      /* scroll-spy */
      var cur=-1;
      secs.forEach(function(sc,i){if(sc&&sc.getBoundingClientRect().top<=h*.4)cur=i});
      links.forEach(function(a,i){a.classList.toggle('act',i===cur)});
      if(reduce) return;
      /* hero: core turns and drifts, headline fades */
      sp=cl(y/(hero.offsetHeight*.9));
      hc.style.opacity=(1-sp*.85).toFixed(3);
      hc.style.transform='translateY('+(-sp*40).toFixed(1)+'px)';
      /* statement: lines slide in, outline fills */
      var r=state.getBoundingClientRect();
      state.style.setProperty('--f',cl((h*.85-r.top)/(h*.6)).toFixed(3));
      state.style.setProperty('--py2',((r.top/h)*-60).toFixed(1));
      /* process line draws as you scroll */
      var s=steps.getBoundingClientRect();
      steps.style.setProperty('--p',cl((h*.8-s.top)/(h*.45)).toFixed(3));
      /* project mockups: decorative depth parallax */
      projs.forEach(function(pj){
        var b=pj.getBoundingClientRect();
        pj.style.setProperty('--py',(((b.top+b.height/2-h/2)/h)*-38).toFixed(1));
      });
    }
    function req(){if(!tick){tick=true;requestAnimationFrame(upd)}}
    addEventListener('scroll',req,{passive:true});addEventListener('resize',req);
    upd();
  })();

  /* broken image links hide cleanly instead of leaving a gap */
  document.querySelectorAll('img').forEach(function(i){
    function bad(){
      var alt=i.getAttribute('data-alt');
      if(alt){i.removeAttribute('data-alt');i.src=alt;return}
      i.classList.add('bad')
    }
    i.addEventListener('error',bad);
    if(i.complete&&i.naturalWidth===0&&i.getAttribute('src'))bad();
  });

  /* templates & concepts: prefill the contact form */
  function pickTpl(name){
    var t=document.querySelector('#f textarea[name="msg"]');
    if(t&&!t.value.trim()){t.value='I\u2019m interested in the '+name+'.'}
  }
  document.querySelectorAll('.tpl-btn').forEach(function(b){
    b.addEventListener('click',function(){
      pickTpl(b.getAttribute('data-tpl'));
      var c=document.getElementById('contact');if(c)c.scrollIntoView({behavior:reduce?'auto':'smooth'});
    });
  });
  document.querySelectorAll('a.visit[data-tpl]').forEach(function(a){
    a.addEventListener('click',function(){pickTpl(a.getAttribute('data-tpl'))});
  });

  /* ---------- form ---------- */
  /* Emails are sent by our own /api/contact function (Gmail).
     EmailJS below is only a backup if that function ever fails. */
  var AUREON_MAIL={publicKey:'hEq5Q_u-GBKe8TxlM',serviceId:'service_qgsskj2',ownerTemplate:'template_8e7mipo',replyTemplate:'template_f40rwga'};
  var mailInit=false;
  function checkMail(){
    var ok=!!(AUREON_MAIL.publicKey&&AUREON_MAIL.serviceId&&AUREON_MAIL.ownerTemplate&&AUREON_MAIL.replyTemplate&&window.emailjs);
    if(ok&&!mailInit){try{emailjs.init({publicKey:AUREON_MAIL.publicKey});mailInit=true}catch(x){ok=false}}
    return ok;
  }

  function showAutoReply(name,project){
    var box=document.getElementById('auto'),logo=document.querySelector('.nav .lm');
    box.innerHTML='';
    var wrap=document.createElement('div');wrap.className='ar';
    var av=document.createElement('img');av.className='ar-av';av.alt='Aureon Tech';if(logo)av.src=logo.src;
    var bub=document.createElement('div');bub.className='ar-b';
    var who=document.createElement('b');who.textContent='Aureon Tech';
    var typing=document.createElement('span');typing.className='ar-t';typing.innerHTML='<i></i><i></i><i></i>';
    bub.appendChild(who);bub.appendChild(typing);wrap.appendChild(av);wrap.appendChild(bub);box.appendChild(wrap);
    setTimeout(function(){
      typing.remove();
      var p1=document.createElement('p');p1.textContent='Hi '+name+'! \u2728 Thank you for reaching out to Aureon.';
      var p2=document.createElement('p');p2.textContent=project?'We\u2019ve got your note about \u201C'+project+'\u201D and our team is already excited to read it.':'We\u2019ve got your message and our team is already excited to read it.';
      var p3=document.createElement('p');p3.textContent='Expect a personal reply within one business day. Until then, have a great day! \ud83d\udc99';
      [p1,p2,p3].forEach(function(p,i){p.style.setProperty('--d',(i*.35)+'s');bub.appendChild(p)});
    },reduce?0:1400);
  }

  document.getElementById('f').addEventListener('submit',function(e){
    e.preventDefault();
    var f=e.target,btn=f.querySelector('button[type=submit]'),ok=document.getElementById('ok');
    var name=(f.name.value||'there').trim().split(/\s+/)[0],
        params={from_name:f.name.value.trim(),from_email:f.email.value.trim(),to_name:name,company:f.company.value.trim()||'-',message:f.msg.value.trim()};
    btn.disabled=true;btn.textContent='Sending\u2026';ok.textContent='';
    params.website=f.website.value;
    function viaApi(){
      return fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)})
        .then(function(r){if(!r.ok)throw new Error('api '+r.status)});
    }
    function viaEmailJS(){
      if(!checkMail())return Promise.reject(new Error('no backup'));
      return Promise.all([
        emailjs.send(AUREON_MAIL.serviceId,AUREON_MAIL.ownerTemplate,params),
        emailjs.send(AUREON_MAIL.serviceId,AUREON_MAIL.replyTemplate,params)
      ]);
    }
    var jobs=[viaApi().catch(viaEmailJS)];
    Promise.all(jobs).then(function(){
      showAutoReply(name,params.message.length>60?params.message.slice(0,57)+'\u2026':params.message);
      ok.textContent='Message sent. A confirmation is on its way to your inbox.';
      f.reset();
    }).catch(function(){
      ok.textContent='Sorry, that didn\u2019t go through. Please email us at aureonhelpcenter@gmail.com.';
    }).then(function(){btn.disabled=false;btn.textContent='Send message'});
  });
})();
