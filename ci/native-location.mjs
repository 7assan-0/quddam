/** Read-only native failure attribution from original stack, TS source and actual PASS output. */
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {root} from './adapter.mjs';
const require=createRequire(join(root,'qalba-platform/package.json')),ts=require('typescript');
const source=process.argv[2],logPath=process.argv[3],log=readFileSync(logPath,'utf8');
const manifest=JSON.parse(readFileSync(join(root,'Quddam-Phase-5.0J-2-Test-Manifest.json')));
const cases=manifest.nativePostgres.cases.filter(c=>c.source===source);
const completed=cases.filter(c=>log.split(/\r?\n/).some(line=>line.trim()==='PASS '+c.title)).map(c=>c.identity);
const text=readFileSync(join(root,'qalba-platform',source),'utf8'),file=ts.createSourceFile(source,text,ts.ScriptTarget.Latest,true);
const locations=[...log.matchAll(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':(\\d+):(\\d+)','g'))].map(x=>({line:Number(x[1]),column:Number(x[2])}));
const calls=[];
function walk(node){
 if(ts.isCallExpression(node)&&node.arguments.length>=2&&(ts.isArrowFunction(node.arguments[1])||ts.isFunctionExpression(node.arguments[1]))){
  const first=node.arguments[0],body=node.arguments[1];
  calls.push({node,first,body});
 }
 ts.forEachChild(node,walk);
}
walk(file);
function expanded(first,node){
 let bindings={};
 for(let parent=node.parent;parent;parent=parent.parent){
  if(!ts.isForOfStatement(parent)||!ts.isVariableDeclarationList(parent.initializer))continue;
  const name=parent.initializer.declarations[0].name.getText(file);let array=parent.expression;
  while(ts.isAsExpression(array)||ts.isParenthesizedExpression(array))array=array.expression;
  if(ts.isArrayLiteralExpression(array)&&array.elements.every(ts.isStringLiteral))bindings[name]=array.elements.map(x=>x.text);
  if(ts.isIdentifier(array)){
   // f.name comes from literal objects pushed into the fixture list. Read the
   // authored declarations only; never evaluate product code to infer a title.
   const properties={};
   const pushes=n=>{if(ts.isCallExpression(n)&&n.expression.getText(file)===array.text+'.push')for(const arg of n.arguments)if(ts.isObjectLiteralExpression(arg))for(const p of arg.properties)if(ts.isPropertyAssignment(p)&&ts.isStringLiteral(p.initializer))(properties[p.name.getText(file)]??=[]).push(p.initializer.text);ts.forEachChild(n,pushes);};
   pushes(file);for(const[k,v]of Object.entries(properties))bindings[name+'.'+k]=v;
   const declarations=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(file)===array.text&&n.initializer){let value=n.initializer;while(ts.isAsExpression(value)||ts.isParenthesizedExpression(value))value=value.expression;if(ts.isArrayLiteralExpression(value)&&value.elements.every(ts.isStringLiteral))bindings[name]=value.elements.map(x=>x.text);}ts.forEachChild(n,declarations);};
   declarations(file);
   if(array.text==='games'){
    const fixture=ts.createSourceFile('database-lifecycle-fixtures.ts',readFileSync(join(root,'qalba-platform/scripts/database-lifecycle-fixtures.ts'),'utf8'),ts.ScriptTarget.Latest,true);
    const gameList=n=>{if(ts.isVariableDeclaration(n)&&n.name.getText(fixture)==='games'&&n.initializer){let value=n.initializer;while(ts.isAsExpression(value)||ts.isParenthesizedExpression(value))value=value.expression;if(ts.isArrayLiteralExpression(value)&&value.elements.every(ts.isStringLiteral))bindings[name]=value.elements.map(x=>x.text);}ts.forEachChild(n,gameList);};gameList(fixture);
   }
  }
 }
 function values(expr){
  if(ts.isStringLiteral(expr)||ts.isNoSubstitutionTemplateLiteral(expr))return[expr.text];
  if(ts.isIdentifier(expr)||ts.isPropertyAccessExpression(expr))return bindings[expr.getText(file)]??null;
  if(ts.isConditionalExpression(expr)){const a=values(expr.whenTrue),b=values(expr.whenFalse);return a&&b?[...a,...b]:null;}
  if(ts.isBinaryExpression(expr)&&expr.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=values(expr.left),b=values(expr.right);return a&&b?a.flatMap(x=>b.map(y=>x+y)):null;}
  if(ts.isTemplateExpression(expr)){let output=[expr.head.text];for(const span of expr.templateSpans){const options=values(span.expression);if(!options)return null;output=output.flatMap(p=>options.map(x=>p+x+span.literal.text));}return output;}
  return null;
 }
 return values(first);
}
let attributed=null;
for(const loc of locations){
 const position=file.getPositionOfLineAndCharacter(loc.line-1,loc.column-1);
 const matched=calls.filter(x=>position>=x.body.getStart(file)&&position<x.body.end).sort((a,b)=>(a.body.end-a.body.getStart(file))-(b.body.end-b.body.getStart(file)));
 for(const call of matched){
  const names=expanded(call.first,call.node);if(!names)continue;
  const candidates=names.map(name=>cases.filter(c=>c.title===name)).flat();
  // Exact callback in the stack + literal loop enumeration + preceding observed
  // PASS entries establish the failed invocation. No global "next case" guess.
  const pending=candidates.filter(c=>!completed.includes(c.identity));
  if(pending.length){attributed={identity:pending[0].identity,title:pending[0].title,originalSource:source,...loc,proof:'original callback stack; literal source enumeration; preceding actual PASS output',candidates:candidates.map(x=>x.identity)};break;}
 }
 if(attributed)break;
}
process.stdout.write(JSON.stringify({source,observedCompletedIdentities:completed,firstFailure:attributed,originalStackLocations:locations,unresolved:!attributed}));
