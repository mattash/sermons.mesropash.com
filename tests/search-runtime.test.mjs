import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

test('emitted JavaScript function loads its modules and serves the published corpus', async () => {
  const directory=await mkdtemp(join(tmpdir(),'sermon-search-runtime-'));
  const names=['CLOUDFLARE_WORKERSAI_API_KEY','CLOUDFLARE_WORKERSAI_ACCOUNT_ID'];
  const previous=names.map(name=>process.env[name]);
  try {
    const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
    const options=ts.parseJsonConfigFileContent(config.config,ts.sys,'.').options;
    await writeFile(join(directory,'package.json'),JSON.stringify({type:'module'}));
    await symlink(join(process.cwd(),'node_modules'),join(directory,'node_modules'),'dir');
    const sources=['api/search.ts',...['archive','topic-taxonomy','scripture','discovery-core','search','search-handler','semantic-search'].map(name=>`src/lib/${name}.ts`)];
    for(const source of sources){
      const output=ts.transpileModule(ts.sys.readFile(source),{compilerOptions:options,fileName:source}).outputText;
      assert(!/from ["'][^"']+\.ts["']/.test(output),`Unresolved TypeScript import in ${source}`);
      const target=join(directory,source.replace(/\.ts$/,'.js'));
      await mkdir(dirname(target),{recursive:true});await writeFile(target,output);
    }
    await mkdir(join(directory,'scripts'));
    await copyFile('scripts/discovery-content.mjs',join(directory,'scripts/discovery-content.mjs'));
    // Explicit Scripture searches bypass inference; these are deliberately fake values.
    process.env[names[0]]='fixture-not-a-real-credential';process.env[names[1]]='a'.repeat(32);
    const {POST}=await import(pathToFileURL(join(directory,'api/search.js')).href);
    const response=await POST(new Request('https://sermons.mesropash.com/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:'Matt. 5'})}));
    assert.equal(response.status,200);
    const result=await response.json();assert.equal(result.mode,'transcript');assert(result.hits.length>0);
  } finally {
    names.forEach((name,i)=>{if(previous[i]===undefined)delete process.env[name];else process.env[name]=previous[i];});
    await rm(directory,{recursive:true,force:true});
  }
});
