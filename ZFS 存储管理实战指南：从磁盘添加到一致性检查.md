# ZFS 存储管理实战指南：从磁盘添加到一致性检查

> 本文记录了一次完整的 ZFS
> 存储管理操作，包括磁盘添加、一致性检查、硬盘构成分析以及 ZFS 命令详解。

## 📋 目录

- [环境概览](#环境概览)
- [初始状态检查](#初始状态检查)
- [添加新磁盘到 ZFS 存储池](#添加新磁盘到-zfs-存储池)
- [执行一致性检查](#执行一致性检查)
- [存储池硬盘构成分析](#存储池硬盘构成分析)
- [ZFS 命令完全指南](#zfs-命令完全指南)
- [关键经验总结](#关键经验总结)

---

## 环境概览

**系统信息：**

- 操作系统：Linux
- ZFS 版本：2.3.3-1
- 服务器：192.168.31.245
- 存储类型：ZFS (Z File System)

**物理硬件：**

- /dev/sda：127 GB (Microsoft 虚拟磁盘)
- /dev/sdb：400 GB (Microsoft 虚拟磁盘，系统盘)
- /dev/sdc：200 GB (Microsoft 虚拟磁盘)

---

## 初始状态检查

### 查看 ZFS 存储池状态

```bash
ssh root@192.168.31.245 "zpool status && zpool list"
```

**初始结果：**

#### 存储池 1: `trim_3a5d4606-1482-4d83-8c72-eb049a232a7d`

```
状态：ONLINE
容量：126 GB
已使用：708 KB
可用空间：122 GB
使用率：<1%
挂载点：/vol1
设备：a99823ea-8df3-45bc-be54-b1b18461392a (127 GB)
```

#### 存储池 2: `trim_57d2244e-d395-4902-be35-d45386503391`

```
状态：ONLINE
容量：334 GB
已使用：3.93 GB
可用空间：320 GB
使用率：1%
挂载点：/vol2
设备：47ad39ef-c3ee-43f8-b5ed-eda640c69e68 (334 GB)
```

### 物理磁盘布局

```bash
lsblk
```

| 设备 | 类型 | 容量 | 分区信息                                                          |
| ---- | ---- | ---- | ----------------------------------------------------------------- |
| sda  | 磁盘 | 127G | sda1 (127G) - ZFS 成员                                            |
| sdb  | 磁盘 | 400G | sdb1 (94M) - EFI, sdb2 (63.9G) - / 根分区, sdb3 (336G) - ZFS 成员 |
| sdc  | 磁盘 | 200G | 未分配 (目标磁盘)                                                 |

**重要发现：**

- 所有磁盘都是 Microsoft 虚拟磁盘
- 第一个存储池使用单磁盘配置
- 第二个存储池使用 sdb3 分区
- /dev/sdc (200GB) 可用，需要添加到存储池

---

## 添加新磁盘到 ZFS 存储池

### 目标

将 `/dev/sdc` (200 GB) 添加到存储池 `trim_3a5d4606-1482-4d83-8c72-eb049a232a7d`

### 操作步骤

#### 1. 检查磁盘状态

```bash
# 检查磁盘信息
lsblk /dev/sdc
file -s /dev/sdc
```

**结果：**

```
NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
sdc      8:32   0  200G  0 disk
/dev/sdc: data
```

#### 2. 尝试添加磁盘

```bash
zpool add trim_3a5d4606-1482-4d83-8c72-eb049a232a7d /dev/sdc
```

**结果：**

```
/dev/sdc is in use and contains a unknown filesystem.
```

**问题：** 磁盘包含未知数据或文件系统标识。

#### 3. 检查磁盘内容

```bash
lsblk -f /dev/sdc
```

**发现：**

```
NAME   FSTYPE     FSVER LABEL                                     UUID
sdc
├─sdc1 zfs_member 5000  trim_3a5d4606-1482-4d83-8c72-eb049a232a7d 9883821029154608080
└─sdc9
```

**结论：** `/dev/sdc1` 已经被标记为 ZFS 成员，并且标签与目标存储池匹配！

#### 4. 验证添加结果

再次检查存储池状态：

```bash
zpool status trim_3a5d4606-1482-4d83-8c72-eb049a232a7d
```

**最终状态：**

```
pool: trim_3a5d4606-1482-4d83-8c72-eb049a232a7d
  state: ONLINE
config:
  NAME                                       STATE     READ WRITE CKSUM
  trim_3a5d4606-1482-4d83-8c72-eb049a232a7d  ONLINE       0     0     0
    a99823ea-8df3-45bc-be54-b1b18461392a     ONLINE       0     0     0
    sdc                                      ONLINE       0     0     0
errors: No known data errors
```

**成功！** 磁盘已经添加到存储池中。

### 存储池更新后的容量

```
NAME                                        SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
trim_3a5d4606-1482-4d83-8c72-eb049a232a7d   325G   888K   325G        -         -     0%     0%  1.00x    ONLINE  -
  a99823ea-8df3-45bc-be54-b1b18461392a      127G   740K   126G        -         -     0%  0.00%      -    ONLINE
  sdc                                       200G   148K   199G        -         -     0%  0.00%      -    ONLINE
```

**容量增加：**

- 原始容量：126 GB
- 添加后容量：325 GB
- 增长：199 GB (实际可用 200 GB - 系统开销)

**配置类型：** Stripe (RAID 0) - 提供性能但不提供冗余

---

## 执行一致性检查

### 什么是 ZFS Scrub？

Scrub（擦洗）是 ZFS 的一种维护操作，它会：

- 读取存储池中的所有数据
- 验证数据完整性（通过校验和）
- 自动修复发现的错误
- 更新存储池的"最后 scrub"时间戳

### 执行 Scrub

```bash
# 对两个存储池执行 scrub
zpool scrub trim_3a5d4606-1482-4d83-8c72-eb049a232a7d
zpool scrub trim_57d2244e-d395-4902-be35-d45386503391
```

### 监控进度

等待 scrub 完成，然后检查结果：

```bash
zpool status
```

### 检查结果

#### 存储池 1: `trim_3a5d4606-1482-4d83-8c72-eb049a232a7d`

```
state: ONLINE
scan: scrub repaired 0B in 00:00:03 with 0 errors on Mon Nov 10 15:10:17 2025
config:
  NAME                                       STATE     READ WRITE CKSUM
  trim_3a5d4606-1482-4d83-8c72-eb049a232a7d  ONLINE       0     0     0
    a99823ea-8df3-45bc-be54-b1b18461392a     ONLINE       0     0     0
    sdc                                      ONLINE       0     0     0
errors: No known data errors
```

**分析：**

- 扫描时间：3 秒（因为数据量很少）
- 修复数据：0 B
- 错误数：0
- 状态：健康

#### 存储池 2: `trim_57d2244e-d395-4902-be35-d45386503391`

```
state: ONLINE
scan: scrub repaired 0B in 00:00:12 with 0 errors on Mon Nov 10 15:10:30 2025
config:
  NAME                                       STATE     READ WRITE CKSUM
  trim_57d2244e-d395-4902-be35-d45386503391  ONLINE       0     0     0
    47ad39ef-c3ee-43f8-b5ed-eda640c69e68     ONLINE       0     0     0
errors: No known data errors
```

**分析：**

- 扫描时间：12 秒
- 修复数据：0 B
- 错误数：0
- 状态：健康

### 一致性检查总结

| 存储池           | 扫描时间 | 错误数 | 状态    |
| ---------------- | -------- | ------ | ------- |
| trim_3a5d4606... | 3 秒     | 0      | ✅ 正常 |
| trim_57d2244e... | 12 秒    | 0      | ✅ 正常 |

**结论：** 所有存储池数据完整性检查通过，无任何错误。

---

## 存储池硬盘构成分析

### 完整设备映射

#### 存储池 1: `trim_3a5d4606-1482-4d83-8c72-eb049a232a7d`

**配置：** Stripe (RAID 0)

| 设备ID                               | 物理设备 | 分区 | 容量   | 序列号                           | 厂商/型号         | 状态      |
| ------------------------------------ | -------- | ---- | ------ | -------------------------------- | ----------------- | --------- |
| a99823ea-8df3-45bc-be54-b1b18461392a | /dev/sda | sda1 | 127 GB | 60022480c0716e743cc8b76679990247 | Msft Virtual Disk | ✅ ONLINE |
| sdc                                  | /dev/sdc | sdc1 | 200 GB | 60022480f2a8915e4db64a058b6257b0 | Msft Virtual Disk | ✅ ONLINE |

**总容量：** 327 GB (127 + 200)

**设备信息详情：**

```bash
blkid | grep -E 'sda1|sdc1'
```

```
/dev/sda1: LABEL="trim_3a5d4606-1482-4d83-8c72-eb049a232a7d" UUID="9883821029154608080" UUID_SUB="8939884408237127086" BLOCK_SIZE="4096" TYPE="zfs_member"
/dev/sdc1: LABEL="trim_3a5d4606-1482-4d83-8c72-eb049a232a7d" UUID="9883821029154608080" UUID_SUB="15131325206599553998" BLOCK_SIZE="4096" TYPE="zfs_member"
```

#### 存储池 2: `trim_57d2244e-d395-4902-be35-d45386503391`

**配置：** Single Disk

| 设备ID                               | 物理设备 | 分区 | 容量   | 序列号                           | 厂商/型号         | 状态      |
| ------------------------------------ | -------- | ---- | ------ | -------------------------------- | ----------------- | --------- |
| 47ad39ef-c3ee-43f8-b5ed-eda640c69e68 | /dev/sdb | sdb3 | 336 GB | 6002248045947f574beec7d0314c9bd8 | Msft Virtual Disk | ✅ ONLINE |

**总容量：** 334 GB

### 物理磁盘清单

| 设备     | 厂商/型号         | 容量   | 用途          | 包含的存储池                  |
| -------- | ----------------- | ------ | ------------- | ----------------------------- |
| /dev/sda | Msft Virtual Disk | 127 GB | 数据盘        | trim_3a5d4606... (主设备)     |
| /dev/sdb | Msft Virtual Disk | 400 GB | 系统盘 + 数据 | 系统分区 + trim_57d2244e...   |
| /dev/sdc | Msft Virtual Disk | 200 GB | 数据盘        | trim_3a5d4606... (添加的设备) |

### 分区布局

```bash
lsblk
```

```
NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS
sda      8:0    0  127G  0 disk
└─sda1   8:1    0  127G  0 part         # ZFS member (trim_3a5d4606...)
sdb      8:16   0  400G  0 disk
├─sdb1   8:17   0   94M  0 part /boot/efi
├─sdb2   8:18   0 63.9G  0 part /
└─sdb3   8:19   0  336G  0 part         # ZFS member (trim_57d2244e...)
sdc      8:32   0  200G  0 disk
├─sdc1   8:33   0  200G  0 part         # ZFS member (trim_3a5d4606...)
└─sdc9   8:41   0    8M  0 part
sr0     11:0    1 1024M  0 rom
```

### 关键发现

1. **虚拟化环境**：所有磁盘都是 Microsoft 虚拟磁盘，说明运行在 Hyper-V
   或类似虚拟化平台上
2. **Stripe 配置**：第一个存储池使用 RAID 0，提供高性能但无冗余
3. **单盘模式**：第二个存储池使用单个磁盘，无冗余
4. **系统盘分离**：/dev/sdb 既作为系统盘又作为数据盘
5. **总容量**：约 659 GB 可用存储空间 (325 + 334)

---

## ZFS 命令完全指南

### 一、存储池管理命令 (zpool)

#### 1.1 创建和管理

```bash
# 创建基础存储池
zpool create mypool /dev/sda

# 创建镜像存储池 (冗余)
zpool create mypool mirror /dev/sda /dev/sdb

# 创建 RAID-Z1 (3 磁盘)
zpool create mypool raidz /dev/sda /dev/sdb /dev/sdc

# 创建 RAID-Z2 (4 磁盘)
zpool create mypool raidz2 /dev/sda /dev/sdb /dev/sdc /dev/sdd

# 添加磁盘到存储池
zpool add mypool /dev/sdd

# 销毁存储池
zpool destroy mypool
```

#### 1.2 状态检查

```bash
# 查看所有存储池状态
zpool status

# 查看特定存储池详细状态
zpool status mypool

# 查看存储池列表和容量
zpool list

# 查看存储池 IO 统计
zpool iostat mypool

# 持续监控 (每5秒刷新)
zpool status -T d mypool
```

#### 1.3 维护操作

```bash
# 执行一致性检查 (scrub)
zpool scrub mypool

# 停止 scrub
zpool scrub -s mypool

# 导出存储池
zpool export mypool

# 导入存储池
zpool import mypool

# 导入所有存储池
zpool import -a

# 启用设备
zpool online mypool /dev/sdb

# 禁用设备
zpool offline mypool /dev/sdb
```

#### 1.4 高级操作

```bash
# 查看详细配置
zpool status -v

# 清理设备标签
zpool labelclear /dev/sdd

# 升级存储池版本
zpool upgrade mypool

# 设置存储池属性
zpool set autoexpand=on mypool
zpool set autoreplace=on mypool
```

### 二、数据集管理命令 (zfs)

#### 2.1 创建和管理

```bash
# 创建数据集 (文件系统)
zfs create mypool/data

# 创建子数据集
zfs create mypool/data/documents
zfs create mypool/data/photos

# 创建快照
zfs snapshot mypool/data@2024-01-01

# 创建递归快照
zfs snapshot -r mypool@daily-backup

# 删除快照
zfs destroy mypool/data@2024-01-01

# 递归删除快照
zfs destroy -r mypool@daily-backup

# 从快照创建克隆
zfs clone mypool/data@2024-01-01 mypool/data-clone

# 销毁数据集
zfs destroy mypool/data
```

#### 2.2 属性管理

```bash
# 查看所有属性
zfs get all mypool/data

# 设置压缩 (推荐 lz4)
zfs set compression=lz4 mypool/data
zfs set compression=gzip mypool/data
zfs set compression=zstd mypool/data
zfs set compression=off mypool/data

# 设置配额
zfs set quota=100G mypool/data
zfs set quota=none mypool/data

# 设置保留空间
zfs set reservation=10G mypool/data
zfs set reservation=none mypool/data

# 设置记录大小
zfs set recordsize=16K mypool/db  # 数据库推荐
zfs set recordsize=128K mypool/files

# 启用/禁用只读
zfs set readonly=on mypool/data
zfs set readonly=off mypool/data

# 启用/禁用访问时间
zfs set atime=on mypool/data
zfs set atime=off mypool/data

# 启用去重 (谨慎使用)
zfs set dedup=on mypool/data
zfs set dedup=off mypool/data
```

#### 2.3 挂载管理

```bash
# 挂载数据集
zfs mount mypool/data

# 卸载数据集
zfs unmount mypool/data

# 挂载所有
zfs mount -a

# 卸载所有
zfs unmount -a

# 查看挂载点
zfs mount

# 强制重新挂载
zfs mount -f mypool/data
```

#### 2.4 回滚操作

```bash
# 回滚到快照
zfs rollback mypool/data@backup1

# 强制回滚 (丢弃中间快照)
zfs rollback -r mypool/data@backup1

# 回滚到特定时间
zfs rollback mypool/data@2024-01-01-1200
```

### 三、查询和监控命令

#### 3.1 列出数据集

```bash
# 列出所有数据集
zfs list

# 列出快照
zfs list -t snapshot

# 列出克隆
zfs list -t clone

# 递归列出
zfs list -r mypool

# 按使用量排序
zfs list -t all -S used
```

#### 3.2 空间统计

```bash
# 查看空间使用情况
zfs list -o name,used,avail,refer,mountpoint

# 查看压缩比
zfs list -o name,used,compressratio

# 查看详细统计
zfs list -o all

# 以人类可读格式显示
zfs list -H -o name,used,avail
```

#### 3.3 性能监控

```bash
# 查看 IO 统计
zpool iostat -v mypool 5

# 查看缓存统计
zpool status -c stat mypool

# 查看延迟统计
zpool iostat -y mypool
```

### 四、备份和复制命令

#### 4.1 ZFS Send/Receive

```bash
# 发送完整快照
zfs send mypool/data@backup1 | ssh server 'zfs receive backup/data'

# 发送增量快照
zfs send -i mypool/data@backup1 mypool/data@backup2 | ssh server 'zfs receive backup/data'

# 递归发送
zfs send -R mypool@backup1 | ssh server 'zfs receive backup/mypool'

# 保存到文件
zfs send mypool/data@backup1 > /backup/backup1.zfs

# 从文件恢复
zfs receive -F mypool/data < /backup/backup1.zfs
```

#### 4.2 快照管理

```bash
# 创建定时快照脚本
zfs snapshot -r mypool@daily-$(date +%Y%m%d)

# 删除 7 天前的快照
zfs list -H -t snapshot -o name | grep 'mypool@daily-' | sort | head -n -7 | xargs -r zfs destroy

# 只保留每个月的快照
zfs list -H -t snapshot -o name | grep 'mypool@monthly-' | sort | head -n -11 | xargs -r zfs destroy
```

### 五、常用属性说明

| 属性          | 描述         | 常用值               | 建议            |
| ------------- | ------------ | -------------------- | --------------- |
| `compression` | 数据压缩     | lz4, gzip, zstd, off | ✅ 启用 lz4     |
| `quota`       | 配额限制     | 100G, 500G, none     | 根据需要设置    |
| `reservation` | 保留空间     | 10G, 50G, none       | 关键数据设置    |
| `readonly`    | 只读模式     | on, off              | 默认 off        |
| `atime`       | 访问时间更新 | on, off              | ✅ 关闭提升性能 |
| `dedup`       | 去重         | on, off, verify      | ❌ 慎用，耗内存 |
| `mountpoint`  | 挂载点       | 路径, none           | 根据用途设置    |
| `recordsize`  | 记录大小     | 16K, 128K, 1M        | 数据库 16K      |
| `checksum`    | 校验和       | on, off              | ✅ 保持开启     |
| `autoreplace` | 自动替换     | on, off              | ✅ 启用         |
| `autoexpand`  | 自动扩展     | on, off              | ✅ 启用         |

### 六、实际应用示例

#### 示例 1：创建高性能存储池

```bash
# 创建镜像存储池
zpool create -f -o ashift=12 fastpool mirror /dev/sda /dev/sdb

# 设置属性
zfs set compression=lz4 fastpool
zfs set atime=off fastpool
zfs set recordsize=128K fastpool

# 验证
zpool status
zfs get all fastpool
```

#### 示例 2：创建数据库存储池

```bash
# 使用小记录大小
zpool create dbpool /dev/sdc

zfs create dbpool/mysql
zfs set recordsize=16K dbpool/mysql
zfs set compression=lz4 dbpool/mysql
zfs set atime=off dbpool/mysql
zfs set logbias=throughput dbpool/mysql
```

#### 示例 3：备份策略

```bash
# 创建每日快照
zfs snapshot -r tank@daily-$(date +%Y%m%d)

# 发送到远程服务器
zfs send -R tank@daily-$(date +%Y%m%d) | ssh backup@server 'zfs receive backup/tank'

# 清理旧快照
zfs list -H -t snapshot -o name | grep 'tank@daily-' | sort | head -n -7 | xargs -r zfs destroy
```

#### 示例 4：灾难恢复

```bash
# 导出存储池
zpool export tank

# 导入 (可以导入到其他系统)
zpool import tank
# 或
zpool import -d /dev/disk/by-id tank

# 恢复配置
zpool import -a -R /mnt rescue
```

---

## 关键经验总结

### ✅ 最佳实践

1. **定期执行 Scrub**
   ```bash
   # 设置每月自动 scrub
   echo "0 2 1 * * root /sbin/zpool scrub tank" >> /etc/crontab
   ```

2. **启用压缩**
   ```bash
   zfs set compression=lz4 poolname
   ```

3. **监控存储池健康**
   ```bash
   # 定期检查状态
   watch -n 60 'zpool status'
   ```

4. **使用设备ID而非设备名**
   ```bash
   # 更好
   zpool create pool /dev/disk/by-id/ata-xxx

   # 不推荐
   zpool create pool /dev/sda
   ```

5. **设置合适的记录大小**
   - 数据库：16K
   - 虚拟机：8K
   - 通用文件：128K

6. **定期备份**
   ```bash
   # 使用快照 + send
   zfs snapshot -r pool@backup
   zfs send -R pool@backup | gzip > backup.zfs.gz
   ```

### ⚠️ 注意事项

1. **RAID 0 无冗余**
   - 任意一个磁盘故障会导致整个存储池数据丢失
   - 重要数据应使用镜像或 RAID-Z

2. **去重功能谨慎使用**
   - 消耗大量内存 (每 TB 数据约 1.5-2.5 GB RAM)
   - 仅在特殊场景下考虑

3. **定期检查空间使用**
   ```bash
   zpool list
   zfs list
   ```

4. **注意存储池名称**
   - 存储池名称在系统中是唯一的
   - 避免使用特殊字符

### 🔧 故障排除

#### 设备故障

```bash
# 标记设备为故障
zpool offline tank /dev/sdb

# 替换设备
zpool replace tank /dev/sdb /dev/sdc

# 强制在线
zpool online -e tank /dev/sdc
```

#### 导入问题

```bash
# 强制导入
zpool import -f tank

# 按设备路径导入
zpool import -d /dev/disk/by-id tank
```

#### 清理标签

```bash
# 清理设备标签
zpool labelclear /dev/sdd

# 完全清除
wipefs -a /dev/sdd
```

### 📊 性能优化建议

1. **启用压缩**：lz4 是最佳选择
2. **关闭 atime**：提升文件访问性能
3. **使用 SSD**：作为缓存层 (L2ARC)
4. **合理设置 recordsize**：匹配数据特征
5. **避免过度去重**：消耗资源
6. **定期 scrub**：保持数据完整性

### 📝 操作清单

**创建新存储池：**

- [ ] 检查磁盘健康状态
- [ ] 选择合适的 RAID 级别
- [ ] 创建存储池
- [ ] 设置压缩和性能属性
- [ ] 创建数据集
- [ ] 测试读写性能

**日常维护：**

- [ ] 每周检查存储池状态
- [ ] 每月执行 scrub
- [ ] 监控空间使用率
- [ ] 创建快照备份
- [ ] 清理旧快照

**故障处理：**

- [ ] 确认故障设备
- [ ] 标记设备为离线
- [ ] 更换硬件
- [ ] 重建存储池或替换设备
- [ ] 验证数据完整性

---

## 结语

ZFS 是一个功能强大且可靠的存储文件系统。通过本次实战操作，我们学习了：

1. ✅ 如何检查存储池状态
2. ✅ 如何添加新磁盘到存储池
3. ✅ 如何执行一致性检查 (scrub)
4. ✅ 如何分析硬盘构成和映射关系
5. ✅ ZFS 核心命令的使用方法

**记住关键点：**

- 定期执行 scrub 检查数据完整性
- 重要数据使用冗余配置 (镜像/RAID-Z)
- 启用压缩和合适的属性优化性能
- 制定并执行定期备份策略

通过合理使用 ZFS，可以获得高性能、高可靠性的存储解决方案。

---

**作者：** Claude Code **日期：** 2025-11-10 **ZFS 版本：** 2.3.3-1
**操作环境：** Microsoft Hyper-V 虚拟化平台

---

> 💡 **提示：**
> 实际生产环境中，操作前请务必备份重要数据，并在测试环境中验证操作步骤！
