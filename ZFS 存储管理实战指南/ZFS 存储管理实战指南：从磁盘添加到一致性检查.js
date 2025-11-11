// ZFS 存储管理实战指南 JavaScript
console.log("ZFS 存储管理实战指南页面已加载");

// 添加代码块复制功能
document.addEventListener("DOMContentLoaded", function () {
  const codeBlocks = document.querySelectorAll(".code-block");

  codeBlocks.forEach((block) => {
    // 创建复制按钮
    const copyBtn = document.createElement("button");
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
    copyBtn.className =
      "absolute top-2 right-2 bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors opacity-0 hover:opacity-100";
    copyBtn.style.cssText =
      "position: absolute; top: 8px; right: 8px; background-color: #3b82f6; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer; transition: all 0.3s;";

    // 为父容器添加相对定位
    block.style.position = "relative";
    block.appendChild(copyBtn);

    // 复制功能
    copyBtn.addEventListener("click", function () {
      const text = block.textContent.trim();
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
        copyBtn.style.backgroundColor = "#10b981";

        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
          copyBtn.style.backgroundColor = "#3b82f6";
        }, 2000);
      }).catch((err) => {
        console.error("复制失败:", err);
      });
    });

    // 悬停时显示按钮
    block.addEventListener("mouseenter", () => {
      copyBtn.style.opacity = "1";
    });

    block.addEventListener("mouseleave", () => {
      copyBtn.style.opacity = "0";
    });
  });

  // 命令输出框也添加复制功能
  const commandOutputs = document.querySelectorAll(".command-output");

  commandOutputs.forEach((output) => {
    const copyBtn = document.createElement("button");
    copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
    copyBtn.className =
      "absolute top-2 right-2 bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700 transition-colors opacity-0 hover:opacity-100";
    copyBtn.style.cssText =
      "position: absolute; top: 8px; right: 8px; background-color: #4b5563; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer; transition: all 0.3s;";

    output.style.position = "relative";
    output.appendChild(copyBtn);

    copyBtn.addEventListener("click", function () {
      const text = output.textContent.trim();
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已复制';
        copyBtn.style.backgroundColor = "#10b981";

        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> 复制';
          copyBtn.style.backgroundColor = "#4b5563";
        }, 2000);
      }).catch((err) => {
        console.error("复制失败:", err);
      });
    });

    output.addEventListener("mouseenter", () => {
      copyBtn.style.opacity = "1";
    });

    output.addEventListener("mouseleave", () => {
      copyBtn.style.opacity = "0";
    });
  });

  // 添加平滑滚动效果
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // 添加卡片悬停动画增强
  const cards = document.querySelectorAll(".card");
  cards.forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-8px) scale(1.02)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(-4px) scale(1)";
    });
  });

  // 初始化工具提示
  console.log("ZFS 实战指南功能初始化完成");
  console.log("支持的存储池类型: Stripe, Mirror, RAID-Z, RAID-Z2");
  console.log("当前环境: Hyper-V 虚拟化平台");
});
