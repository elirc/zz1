import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTypeScript } from './helpers/load-typescript.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const repo={findById:async()=>({id:'d1',title:'Deal',pipelineId:'p1',stageId:'old'}),update:async()=>null,createStageHistory:async()=>{throw Error('should not write')},create:async()=>null,list:async()=>[],count:async()=>0};
const audit={logOrgEvent:async()=>{throw Error('should not audit')}};
const pipeline={requireStage:async()=>({id:'new',pipelineId:'p1',isClosed:false,isWon:false,name:'Working'})};
const prisma={ $transaction: async fn=>fn(prisma) };
const m=await loadTypeScript('src/services/dealService.ts',{root,stubs:{'@/types/auth':{AuthenticatedSession:{}},'@/types/context':{OrgRequestContext:{},RequestContext:{}},'@/types/db':{DbClient:{}},'@/lib/db/prisma':{prisma},'@/lib/permissions/assignment':{resolveAssignableMembership:async()=>({id:'m1'})},'@/repositories/assignmentHistoryRepository':{assignmentHistoryRepository:{}},'@/repositories/dealRepository':{dealRepository:repo},'@/services/auditService':{auditService:audit},'@/services/pipelineService':{pipelineService:pipeline},'@prisma/client':{DealStatus:{OPEN:'OPEN',WON:'WON',LOST:'LOST'},MembershipRole:{},MembershipStatus:{},PlatformRole:{},UserStatus:{},Prisma:{Decimal:class Decimal{constructor(v){this.value=v}}}}}});
const ctx={tenantId:'org1',membership:{membershipId:'m1'},session:{membership:{}}};
test('stage update disappearance stops history and audit with not-found result',async()=>{await assert.rejects(m.dealService.moveDealStage(ctx,'d1',{stageId:'new'}),e=>e.status===404&&e.code==='deal_not_found');});
test('normal update continues to history and audit',async()=>{let history=0,logged=0;repo.update=async()=>({id:'d1',stageId:'new'});repo.createStageHistory=async()=>{history++};audit.logOrgEvent=async()=>{logged++};const out=await m.dealService.moveDealStage(ctx,'d1',{stageId:'new'});assert.equal(out.id,'d1');assert.equal(history,1);assert.equal(logged,1);});


test('pipeline mismatch refuses before update, history and audit',async()=>{
 let writes=0;repo.update=async()=>{writes++;return {id:'d1'};};
 pipeline.requireStage=async()=>({id:'other',pipelineId:'p2',isClosed:false,isWon:false});
 await assert.rejects(m.dealService.moveDealStage(ctx,'d1',{stageId:'other'}),e=>e.status===409&&e.code==='stage_pipeline_mismatch');assert.equal(writes,0);
});
test('closed won stage derives status and close timestamp with shared transaction and scoped context',async()=>{
 pipeline.requireStage=async(context,client)=>{assert.equal(context,ctx);assert.equal(client,prisma);return {id:'won',pipelineId:'p1',isClosed:true,isWon:true,name:'Won'};};
 let payload,history,auditInput;
 repo.update=async(context,client,id,input)=>{assert.equal(context,ctx);assert.equal(client,prisma);assert.equal(id,'d1');payload=input;return {id:'d1',...input};};
 repo.createStageHistory=async(context,client,input)=>{assert.equal(context,ctx);assert.equal(client,prisma);history=input;};
 audit.logOrgEvent=async(context,client,input)=>{assert.equal(context,ctx);assert.equal(client,prisma);auditInput=input;};
 await m.dealService.moveDealStage(ctx,'d1',{stageId:'won',note:'signed'});
 assert.equal(payload.status,'WON');assert.equal(payload.stageId,'won');assert.ok(Number.isFinite(payload.closedAt.getTime()));
 assert.deepEqual(JSON.parse(JSON.stringify(history)),{dealId:'d1',fromStageId:'old',toStageId:'won',changedByMembershipId:'m1',note:'signed'});assert.equal(auditInput.action,'deal.stage.moved');
});

