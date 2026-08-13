# CloakClub

CloakClub 是一个基于 Aleo 测试网的隐私成员社区。当前版本不包含 mock、示例帖子或 `localStorage` 业务状态：成员资格、帖子 commitment 和投票结果来自 Aleo；公开内容和可读元数据来自 Supabase。

## 数据边界

| 数据 | 唯一来源 | 说明 |
| --- | --- | --- |
| 成员凭证、成员密钥 | Aleo 私有 `Member` record | 只在用户钱包中解密，不进入 Supabase |
| 成员凭证发行数 | Aleo `member_count` mapping | 是发行数，不是去重活跃钱包数 |
| 帖子 commitment | Aleo `post_commitments` mapping/交易 | Edge Function 验证交易后才保存正文 |
| 帖子正文、回应数 | Supabase | 正文公开；不保存作者地址 |
| 提案票数、开启状态 | Aleo mappings | 页面直接从测试网 API 读取 |
| 社区/提案名称与描述 | Supabase | 合约只使用 field ID，不存长文本 |

项目需要服务端能力，但不需要自建或常驻 Next.js 服务端。Supabase 提供 Postgres 和一个 `verify-post` Edge Function。匿名客户端只有读取权限；帖子写入必须先由函数核验 Aleo 已确认交易。

## 你需要提供的信息

1. 一个全局唯一的 Aleo program ID，例如 `cloakclub_<唯一后缀>.aleo`。
2. 有测试网 credits 的部署账户。私钥只由你在本机配置或直接使用 Leo/Shield 钱包部署，绝不发到聊天、前端环境变量或 Supabase。
3. 社区名称、社区描述、当前提案标题、描述、截止时间及两个选项的显示文字。
4. 第一批成员的 Aleo 测试网地址。每位成员的 `member_secret` 应在本机用密码学安全随机源独立生成。
5. Supabase 项目的 Project URL、anon/publishable key 和 project ref。`service_role` key 不需要给前端；部署 Edge Function 时 Supabase 会注入。

## 1. 部署 Aleo program

环境要求：Node.js 20+、npm、Leo 4.2+。

当前合约 Program ID 为 `cloakclub_four_2026.aleo`。在仓库根目录被 Git 忽略的 `.env.aleo-deploy` 中填写仅供 Leo CLI 使用的 `PRIVATE_KEY`。不要把私钥放入 Next.js 的 `.env.local`。然后：

部署脚本强制使用 Leo quiet 模式，因为 Leo 4.2 在普通模式下会输出已加载的环境变量。任何曾出现在终端或 CI 日志中的私钥都必须作废并更换。

```bash
./scripts/leo-testnet.sh build
./scripts/deploy-testnet.sh
```

`--base-fees` 和 `--priority-fees` 的单位都是 microcredits。当前测试网节点要求的部署基础费为 `8.710748` credits；项目内的补丁版 Leo 会使用该显式基础费，并额外加入 `0.1` credit 优先费，总费用约为 `8.810748` credits。部署账户应至少准备 10 credits，建议留有更多余额供社区、提案和成员凭证初始化。

部署私钥只应通过 Leo 的本地账户机制或当前终端临时环境提供，不要写入项目文件。

生成两个不重复的 field 作为 `COMMUNITY_ID` 和 `PROPOSAL_ID`，再由部署账户执行：

```bash
./scripts/leo-testnet.sh execute create_community <COMMUNITY_ID>field --broadcast --yes
./scripts/leo-testnet.sh execute create_proposal <COMMUNITY_ID>field <PROPOSAL_ID>field --broadcast --yes
```

为每位成员发行凭证：

```bash
./scripts/leo-testnet.sh execute issue_membership \
  <COMMUNITY_ID>field \
  <MEMBER_ALEO_ADDRESS> \
  <UNIQUE_RANDOM_MEMBER_SECRET>field \
  --broadcast --yes
```

每次执行后应等待交易 accepted，再进行下一步。不要复用 `member_secret`。

日常成员签发不需要继续使用部署脚本。连接 `community_admin` mapping 中的管理员钱包后，页面“我的隐私身份”区域会显示“成员管理”入口；输入成员 Aleo 地址即可由浏览器生成独立随机 `member_secret`，并通过钱包签名执行同一个 `issue_membership` transition。随机密钥只进入加密给成员的私有 `Member` record，不写入 Supabase 或浏览器存储。

当前合约只记录凭证发行总数，不公开成员地址，也没有撤销或地址去重功能。向同一地址重复签发会产生另一份有效凭证；如需邀请审批、成员名册或撤销能力，需要在下一版合约中增加相应状态和 transition 后重新部署。

## 2. 配置 Supabase

安装 Supabase CLI 并登录，然后在仓库根目录执行：

```bash
supabase link --project-ref <PROJECT_REF>
supabase db push
supabase secrets set \
  ALEO_PROGRAM_ID=<PROGRAM_ID>.aleo \
  ALEO_COMMUNITY_ID=<COMMUNITY_ID>field \
  ALEO_API_URL=https://api.explorer.provable.com/v1
supabase functions deploy verify-post
```

在 Supabase SQL Editor 插入真实的社区和提案元数据：

```sql
insert into public.communities (community_id, name, description)
values ('<COMMUNITY_ID>field', '<真实社区名称>', '<真实社区描述>');

insert into public.proposals (proposal_id, community_id, title, description, yes_label, no_label, ends_at)
values (
  '<PROPOSAL_ID>field',
  '<COMMUNITY_ID>field',
  '<真实提案标题>',
  '<真实提案描述>',
  '<选项一名称>',
  '<选项二名称>',
  '<ISO-8601 截止时间>'
);
```

表已启用 RLS：匿名用户可读，但不能直接插入、修改或删除帖子。`verify-post` 会重新计算正文 commitment，并从 Aleo API 校验已接受的 `publish_post` transition 后才入库。

## 3. 配置前端

复制 `.env.example` 为 `.env.local`，填入：

```dotenv
NEXT_PUBLIC_ALEO_PROGRAM_ID=<PROGRAM_ID>.aleo
NEXT_PUBLIC_ALEO_API_URL=https://api.explorer.provable.com/v1
NEXT_PUBLIC_ALEO_EXPLORER_URL=https://testnet.aleo.info
NEXT_PUBLIC_ALEO_TX_FEE=0.1
NEXT_PUBLIC_COMMUNITY_ID=<COMMUNITY_ID>field
NEXT_PUBLIC_PROPOSAL_ID=<PROPOSAL_ID>field
NEXT_PUBLIC_SUPABASE_URL=<SUPABASE_PROJECT_URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_OR_PUBLISHABLE_KEY>
```

然后运行：

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`，连接设置为 Aleo Testnet 的 Shield Wallet 或 Leo Wallet。发帖/投票需要钱包中有当前 program 发出的未消费 `Member` record 和足够的测试网 credits。

`NEXT_PUBLIC_ALEO_TX_FEE` 的配置单位是 ALEO credits。前端会根据钱包适配器转换参数：Leo Wallet 直接接收 credits，Shield 1.29 接收整数 microcredits，因此配置 `0.1` 时会向 Shield 传入 `100000`。请以钱包预估和测试网实际费用为准调整，不要在环境变量中填写 `100000`。

## 验证

```bash
npm run check
```

生产发布前还需做两类人工端到端验证：分别用 Shield Wallet 与 Leo Wallet 完成一次发帖、一次投票；用第二个浏览器确认帖子、票数均来自相同的 Aleo/Supabase 实际状态。
