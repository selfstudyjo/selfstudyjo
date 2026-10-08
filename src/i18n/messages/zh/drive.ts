/**
 * The self-driving simulator pane (CARLA track, app 11) and its GUI panels.
 *
 * Its own area because "drive", "run", "brake" and "replay" here are a CAR and a
 * RECORDING, not a lab run or a tutor reply. Keyboard key names and code
 * (`python drive.py`, `save_to_disk`, `sfs_eval`, `--vehicle`) stay as printed.
 */

import type { Catalogue } from '../../index';

const drive: Catalogue = {
    /* The pane. */
    'Simulator view': '模拟器视图',
    'Loading the simulator…': '正在加载模拟器…',
    'The simulator could not be reached.': '无法连接模拟器。',
    '3D is not available in this browser, so the replay is drawn from above.':
        '此浏览器不支持 3D，因此以俯视图显示回放。',
    'Town': '城镇',
    'Weather': '天气',
    'Script': '脚本',
    'Go': '出发',
    'Drive': '驾驶',
    'Play': '播放',
    'Replay': '回放',
    'Replay position': '回放位置',
    'Playback speed': '播放速度',
    'Wider view': '更宽视图',
    'Running… {v0}s': '运行中… {v0} 秒',
    'Brake': '刹车',
    'BRAKE': '刹车',
    'Off the road': '驶出道路',
    'Crashed - press R to reset': '已碰撞 - 按 R 重置',
    'W / ↑ throttle · S / ↓ brake, then reverse · A D / ← → steer · Space handbrake · R reset':
        'W / ↑ 油门 · S / ↓ 刹车后倒车 · A D / ← → 转向 · Space 手刹 · R 重置',
    'Pick the car your script drives. The pane passes it as --vehicle; the starter scripts read it with argparse.':
        '选择脚本要驾驶的车辆。面板以 --vehicle 参数传入，初始脚本用 argparse 读取。',
    'No run yet. Press Run - or type python drive.py in the CARLA Console.':
        '尚未运行。点击运行，或在 CARLA 控制台中输入 python drive.py。',
    'No collisions, red lights or lane invasions in this run.':
        '本次运行没有碰撞、闯红灯或越线。',
    'What your script prints appears here.': '脚本打印的内容会显示在这里。',
    'Images your script saves with save_to_disk, and estimates it submits with sfs_eval, appear here.':
        '脚本用 save_to_disk 保存的图像以及用 sfs_eval 提交的估计值会显示在这里。',
    'frame': '帧',
    'ground truth': '真实值',
    'your estimate': '你的估计',

    /* The GUI panels and their columns. */
    'Self-Driving (CARLA)': '自动驾驶 (CARLA)',
    'Goals': '目标',
    'Goal': '目标',
    'What it asks': '要求',
    'Met': '已达成',
    'Last run': '最近一次运行',
    'Your runs': '你的运行记录',
    'Defaults': '默认设置',
    'Map': '地图',
    'Vehicle': '车辆',
    'Collisions': '碰撞',
    'Lane invasions': '越线',
    'Red lights': '闯红灯',
    'Driving score': '驾驶得分',
    'Goals met': '已达成目标',
    'Distance (m)': '距离 (米)',
    'Max speed (m/s)': '最高速度 (米/秒)',
    'Sim time (s)': '模拟时间 (秒)',
};

export default drive;
