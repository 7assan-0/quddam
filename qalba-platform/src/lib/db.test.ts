import { afterEach,beforeEach,expect,it,vi } from "vitest";
const mock=vi.hoisted(()=>({client:vi.fn(),adapter:vi.fn()}));
vi.mock("@prisma/adapter-pg",()=>({PrismaPg:class{constructor(options:unknown){mock.adapter(options);}}}));
vi.mock("@/generated/prisma/client",()=>({PrismaClient:class{constructor(options:unknown){mock.client(options);}}}));
import { db } from "./db";
const globalDb=globalThis as unknown as {prisma?:unknown};
beforeEach(()=>{delete globalDb.prisma;vi.clearAllMocks();vi.stubEnv("DATABASE_URL","postgresql://test:test@localhost/test");vi.stubEnv("DATABASE_POOL_MAX","1");});
afterEach(()=>{delete globalDb.prisma;vi.unstubAllEnvs();});
it("production and SSE calls reuse one bounded Prisma pool per process",()=>{
  vi.stubEnv("NODE_ENV","production");const first=db();expect(db()).toBe(first);expect(db()).toBe(first);
  expect(mock.client).toHaveBeenCalledTimes(1);expect(mock.adapter).toHaveBeenCalledExactlyOnceWith({connectionString:"postgresql://test:test@localhost/test",max:1});
});
it("missing configuration and unbounded pool settings remain rejected",()=>{
  for(const max of ["0","21","NaN","1.5"]){vi.stubEnv("DATABASE_POOL_MAX",max);expect(()=>db()).toThrow("DATABASE_POOL_MAX");}
  vi.stubEnv("DATABASE_POOL_MAX","1");vi.stubEnv("DATABASE_URL","");expect(()=>db()).toThrow("DATABASE_URL");
  expect(mock.client).not.toHaveBeenCalled();
});

