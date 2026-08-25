import fs from 'node:fs';
import path from 'node:path';
const routes={
'/features':['LexAMS Features | Training & Programme Management','Manage activities, participants, attendance, assessments, surveys, certificates and reporting from one LexAMS workspace.'],
'/pricing':['LexAMS Pricing | Free & Pro Plans','Start LexAMS free with up to 50 participants, or upgrade to Pro for higher capacity, collaboration and professional reporting.'],
'/solutions':['LexAMS Solutions | Training, NGOs & Education','See how LexAMS supports training providers, NGOs, development programmes and educational institutions.'],
'/solutions/training-providers':['LexAMS for Training Providers','Run training cohorts with registration, attendance, assessment, certification and reporting connected.'],
'/solutions/ngos':['LexAMS for NGOs & Programmes','Turn programme delivery into organised evidence with connected activity and participant records.'],
'/solutions/education':['LexAMS for Schools & Institutions','Coordinate workshops, professional development and institutional learning activities in one workspace.'],
'/security':['LexAMS Security & Data Protection','Learn how LexAMS protects organisation workspaces, public links and billing flows.'],
'/about':['About LexAMS','LexAMS is a programme and activity management product by LexoGraphix Plus.'],
'/contact':['Contact LexAMS','Contact the LexAMS team for product, institutional or billing questions.'],
'/privacy':['LexAMS Privacy','LexAMS privacy information.'],
'/terms':['LexAMS Terms','LexAMS terms of service.']};
const base=fs.readFileSync('dist/index.html','utf8');
for(const [route,[title,description]] of Object.entries(routes)){
 const canonical=`https://lexams.com${route}`;
 let html=base.replace(/<title>.*?<\/title>/s,`<title>${title}</title>`);
 html=html.replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${description}">`);
 html=html.replace('</head>',`<link rel="canonical" href="${canonical}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"></head>`);
 const out=path.join('dist',route.slice(1),'index.html');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,html);
}
console.log(`Generated ${Object.keys(routes).length} static marketing route shells.`);
