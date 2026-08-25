/**
 * Signing in, the profile, plans, payments, notifications, messaging, and the
 * home dashboard — Chinese (Simplified).
 *
 * Two notes specific to this file:
 *
 *  - **The currency is spelled out, not abbreviated.** `JOD` means nothing to a
 *    Chinese reader; 约旦第纳尔 does. The three-letter code is still what
 *    `$money` renders through `Intl` for a value on a statement — this is the
 *    prose around it.
 *  - **The form examples are localised.** 张三 / 李四 is the Chinese equivalent
 *    of John Doe and is what a Chinese reader recognises as a placeholder
 *    rather than as somebody's actual name. The email and username examples
 *    stay Latin, because both fields hold Latin characters and a Han example
 *    would be an instruction to type something the field rejects.
 */

import type { Catalogue } from '../../index';

const account: Catalogue = {
    /* ---------------------------------------------------------------- *
     * Sign in
     * ---------------------------------------------------------------- */
    'Welcome Back': '欢迎回来',
    'Sign in to your Self Study JO account': '登录你的 Self Study JO 账户',
    'Enter your username': '请输入用户名',
    'Enter your password': '请输入密码',
    'Password': '密码',
    'Signing In...': '正在登录……',
    "Don't have an account?": '还没有账户？',
    'Sign up': '注册',
    'Sign in': '登录',
    'Already have an account?': '已经有账户了？',

    /* ---------------------------------------------------------------- *
     * Register
     * ---------------------------------------------------------------- */
    'Join Self Study JO and start learning today': '加入 Self Study JO，今天就开始学习',
    'Create Account': '创建账户',
    'Creating Account...': '正在创建账户……',
    'Username *': '用户名 *',
    'Email *': '邮箱 *',
    'Password *': '密码 *',
    'Confirm Password *': '确认密码 *',
    'Create a strong password': '设置一个强密码',
    'Confirm your password': '再次输入密码',
    'Select gender': '选择性别',
    'Select Gender': '选择性别',
    'I agree to the': '我同意',
    'Terms of Service': '服务条款',
    'Privacy Policy': '隐私政策',
    'and': '和',
    'John': '张',
    'Doe': '三',
    'johndoe': 'zhangsan',
    'john@example.com': 'zhangsan@example.com',
    '🎁 Your': '🎁 你的',
    '{v0}-day free trial': '{v0} 天免费试用',
    '— every feature unlocked — starts as soon as you verify your email.':
        '—— 全部功能开放 —— 邮箱核验完成后立即生效。',

    /* ---------------------------------------------------------------- *
     * Verify email
     * ---------------------------------------------------------------- */
    'Verify Your Email': '核验你的邮箱',
    'Verify Email': '核验邮箱',
    'Verifying...': '正在核验……',
    'We\'ve sent a 6-digit code to {v0}': '我们已向 {v0} 发送了 6 位验证码',
    'Code expires in {v0}': '验证码将在 {v0} 后失效',
    'Code has expired': '验证码已失效',
    'Didn\'t receive the code?': '没有收到验证码？',
    'Change email address': '更换邮箱地址',
    'Email verified successfully! Redirecting...': '邮箱核验成功！正在跳转……',

    /* ---------------------------------------------------------------- *
     * Profile
     * ---------------------------------------------------------------- */
    'Profile Settings': '个人资料设置',
    'Manage your account information and preferences': '管理你的账户信息与偏好设置',
    'Personal Information': '个人信息',
    'Account Information': '账户信息',
    'Profile Picture': '头像',
    'Upload a JPG, PNG, or GIF image (max 5MB)': '上传 JPG、PNG 或 GIF 图片（最大 5MB）',
    'Uploading: {v0}%': '上传中：{v0}%',
    'Email Address': '邮箱地址',
    'Email Status': '邮箱状态',
    'Email Verified': '邮箱已核验',
    'Member Since': '注册时间',
    'Last Updated': '最后更新',
    'Change Password': '修改密码',
    'Current Password': '当前密码',
    'Enter your current password': '请输入当前密码',
    'New Password': '新密码',
    'Confirm New Password': '确认新密码',
    'Password must be at least 8 characters long': '密码至少需要 8 个字符',
    'Save Changes': '保存更改',
    'Danger Zone': '危险操作',
    'Delete Account': '注销账户',
    'Once you delete your account, there is no going back. Please be certain.':
        '账户一经注销将无法恢复，请确认后再操作。',
    'Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently removed.':
        '确定要注销账户吗？此操作无法撤销，你的所有数据都将被永久删除。',
    'Confirm your password to delete account': '输入密码以确认注销账户',
    '✓ Available': '✓ 可用',
    '✗ Username already taken': '✗ 用户名已被占用',
    '✗ Email already registered': '✗ 邮箱已被注册',

    /* ---------------------------------------------------------------- *
     * Notifications
     * ---------------------------------------------------------------- */
    'Mark All as Read': '全部标为已读',
    'Mark as Read': '标为已读',
    'Clear All': '全部清除',
    'Clear all {v0} notifications? The ones sent to you are deleted for good. Announcements are removed from your list and stay in everybody else\'s.':
        '要清除全部 {v0} 条通知吗？发给你个人的将被彻底删除；公告只会从你的列表中移除，其他人仍然可以看到。',
    'Loading your notifications...': '正在加载你的通知……',
    'Loading more notifications...': '正在加载更多通知……',
    'Load More': '加载更多',
    'Unread': '未读',
    'All ({v0})': '全部（{v0}）',
    'Unread ({v0})': '未读（{v0}）',
    'Personal ({v0})': '个人（{v0}）',
    'General ({v0})': '公告（{v0}）',
    'Group ({v0})': '群组（{v0}）',
    'General': '公告',
    'Current User': '当前用户',
    'From:': '来自：',
    'To:': '发送至：',
    'Group:': '群组：',
    '✓ Handled': '✓ 已处理',

    /* ---------------------------------------------------------------- *
     * Plans
     * ---------------------------------------------------------------- */
    'Choose Your Plan': '选择你的套餐',
    'Unlock your learning potential with the perfect plan tailored for your journey':
        '选择最适合你的套餐，释放学习潜力',
    'Loading plans...': '正在加载套餐……',
    'Unable to load plans': '无法加载套餐',
    'What\'s included': '包含内容',
    'Your Current Subscriptions': '你当前的订阅',
    'Payment Pending': '待支付',
    'You have a pending payment for the': '你有一笔待支付的订单，套餐为',
    'plan.': '。',
    'View payment details': '查看支付详情',
    'Cancel payment': '取消支付',
    '⏳ Pending': '⏳ 待处理',
    '✨ {v0} days free': '✨ 免费 {v0} 天',
    'Created: {v0}': '创建于：{v0}',

    /* ---------------------------------------------------------------- *
     * My plans
     * ---------------------------------------------------------------- */
    'My Learning Plans': '我的学习套餐',
    'Manage your subscriptions and track your learning journey': '管理订阅，跟踪你的学习历程',
    'Loading your learning dashboard...': '正在加载你的学习面板……',
    'Unable to Load Plans': '无法加载套餐',
    'No Learning Plans Yet': '还没有学习套餐',
    'Start your educational journey by exploring our premium plans': '浏览我们的高级套餐，开启你的学习之旅',
    'Browse Learning Plans': '浏览学习套餐',
    'Total Plans': '套餐总数',
    'Included Features': '包含的功能',
    'Previous Subscriptions': '历史订阅',
    'Verified Payments': '已确认的支付',
    'Pending Payments': '待支付订单',
    'Complete these payments to activate your subscriptions': '完成这些支付以激活订阅',
    'Currently Active:': '当前生效：',
    '⭐ Currently Active': '⭐ 当前生效',
    '⭐ IN USE': '⭐ 正在使用',
    'ACTIVE': '生效中',
    'EXPIRED': '已过期',
    'Pending': '待处理',
    'PENDING': '待处理',
    'Expires in {v0}': '{v0} 后到期',
    'Plan Type:': '套餐类型：',
    'Subscription ID:': '订阅 ID：',
    'Payment ID:': '支付 ID：',
    'Reference Number:': '参考号：',
    'Method:': '方式：',
    'Cancel Payment': '取消支付',
    'Subscription successfully created': '订阅创建成功',
    '{v0} of {v1} pending': '{v1} 笔中有 {v0} 笔待处理',
    'You have multiple active subscriptions. Click "Use This Plan" to switch between them.':
        '你有多个生效中的订阅。点击“使用此套餐”即可切换。',
    'Payment Instructions': '支付说明',
    '1. Transfer': '1. 转账',
    '1. Send': '1. 发送',
    'to:': '至：',
    'via Cliq to:': '通过 Cliq 发送至：',
    'Bank': '银行',
    '📋 Copy Details': '📋 复制详情',
    '📞 Contact Admin': '📞 联系管理员',

    /* ---------------------------------------------------------------- *
     * Payment
     * ---------------------------------------------------------------- */
    'Complete Your Purchase': '完成购买',
    'Select payment method and complete your subscription': '选择支付方式并完成订阅',
    'Loading payment options...': '正在加载支付方式……',
    'Payment Error': '支付出错',
    'Payment Method:': '支付方式：',
    'Payment Summary': '支付摘要',
    'Plan Summary': '套餐摘要',
    'Bank Transfer': '银行转账',
    'Cliq Transfer': 'Cliq 转账',
    'No Bank Accounts Available': '暂无可用的银行账户',
    'No Cliq Accounts Available': '暂无可用的 Cliq 账户',
    'Please check back later or use Bank transfer': '请稍后再试，或改用银行转账',
    'Please check back later or use Cliq transfer': '请稍后再试，或改用 Cliq 转账',
    'Selected Account:': '选定账户：',
    'Account Holder:': '账户持有人：',
    'Branch:': '开户行：',
    'Address:': '地址：',
    'Price:': '价格：',
    'Total Amount:': '应付总额：',
    '← Back to Plans': '← 返回套餐',

    /* ---------------------------------------------------------------- *
     * Home dashboard
     * ---------------------------------------------------------------- */
    'Welcome back, {v0}!': '欢迎回来，{v0}！',
    'Track your learning progress and achievements': '跟踪你的学习进度与成就',
    'My Courses': '我的课程',
    'Courses you\'re currently enrolled in': '你当前已报名的课程',
    'No courses enrolled yet': '还没有报名任何课程',
    'Browse Courses': '浏览课程',
    'Assigned Homeworks': '已布置的作业',
    'Homework for your enrolled courses': '你已报名课程的作业',
    'No homeworks assigned': '没有布置的作业',
    'Your earned certificates': '你获得的证书',
    'No exam certificates yet': '还没有考试证书',
    'No course certificates yet': '还没有课程证书',
    'Your recent quiz performance': '你近期的小测表现',
    'No quiz results yet': '还没有小测成绩',
    'All your currently active subscription plans': '你当前生效的全部订阅套餐',
    'No active subscription': '没有生效中的订阅',
    'Plan Name': '套餐名称',
    'Features included': '包含的功能',
    'No features attached to this plan': '此套餐未附带任何功能',
    'Expires': '到期',
    'Registered: {v0}': '报名时间：{v0}',
    '· {v0} combined feature{v1}': '· 共 {v0} 项功能',

    /* ---------------------------------------------------------------- *
     * Messaging (app 35)
     * ---------------------------------------------------------------- */
    'Pick a conversation': '选择一个会话',
    'Or start a new one. Messages, pictures and voice notes, free with your account.':
        '或者发起新会话。文字、图片和语音留言，账户内免费使用。',
    'Edit message': '编辑消息',
    'Close picture': '关闭图片',
    'Loading your conversations': '正在加载你的会话',
    'No conversations yet': '还没有会话',
    'Start one with a classmate or a teacher — it is free with your account.':
        '和同学或老师聊聊 —— 账户内免费使用。',
    'Search conversations': '搜索会话',
    'Search conversations…': '搜索会话……',
    'Nothing matches “{v0}”.': '没有内容符合“{v0}”。',
    'Back to conversations': '返回会话列表',
    '· {v0} online': '· {v0} 人在线',
    'Notifications are muted for this conversation': '此会话的通知已静音',
    'No messages yet': '还没有消息',
    'Say hello — messages, pictures and voice notes.': '打个招呼吧 —— 支持文字、图片和语音留言。',
    'This is the beginning of the conversation.': '这是会话的开始。',
    'Load earlier messages': '加载更早的消息',
    'Loading earlier messages…': '正在加载更早的消息……',
    'Send': '发送',
    'Sending': '发送中',
    'Sent': '已发送',
    'Read': '已读',
    'Not sent · retry': '未发送 · 重试',
    'edited': '已编辑',
    'More': '更多',
    'More actions': '更多操作',
    'Reply to this message': '回复此消息',
    'Loading picture': '正在加载图片',
    'Attach a picture': '添加图片',
    'Record a voice note': '录制语音留言',
    'Discard attachment': '取消附件',
    'Cancel reply': '取消回复',
    'Replying to {v0}': '回复 {v0}',
    'Uploading…': '上传中……',
    '· {v0}% smaller': '· 已压缩 {v0}%',
    'Emoji': '表情',
    'Insert an emoji': '插入表情',
    'Close details': '关闭详情',
    'Shared pictures': '共享图片',
    'Add a topic…': '添加主题……',
    'Add': '添加',
    'Admin': '管理员',
    'Member': '成员',
    'By': '创建者',
    'Started': '创建于',
    'online': '在线',
    'Mute this conversation': '将此会话静音',
    'No chime and no notification email. The messages still arrive.':
        '不再有提示音和通知邮件，消息仍会正常送达。',
    'Leave this conversation': '退出此会话',
    'Delete for everyone': '为所有人删除',
    'One to one': '单聊',
    'Search by name or username…': '按姓名或用户名搜索……',
    'Searching': '搜索中',
    'Type at least two letters to find somebody.': '请至少输入两个字符来查找用户。',
    'e.g. Physics revision': '例如：物理复习',

    /* ---------------------------------------------------------------- *
     * The support widget (app 9) — a different service from the messaging
     * above, so the wording says "support" rather than "messages".
     * ---------------------------------------------------------------- */
    'Welcome to SelfStudy Support': '欢迎使用 SelfStudy 客服',
    'SelfStudy Support': 'SelfStudy 客服',
    'We\'re here to help! Ask us anything about courses, progress, or technical issues.':
        '我们随时为你提供帮助！课程、学习进度或技术问题都可以问。',
    'Typical response time: 2-5 minutes': '通常 2–5 分钟内回复',
    'Open chat': '打开对话',
    'Close chat': '关闭对话',
    'Minimize chat': '最小化对话',
    'Connecting to chat...': '正在连接客服……',
    'Reconnecting...': '正在重新连接……',
    'Offline': '离线',
    'Press Enter to send, Shift+Enter for new line': '按 Enter 发送，Shift+Enter 换行',
    'You': '你',
    '👨‍🏫 Support': '👨‍🏫 客服',
    '🤖 System': '🤖 系统',
};

export default account;
