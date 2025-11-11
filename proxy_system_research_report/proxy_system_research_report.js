// 平滑滚动到指定章节
document.querySelectorAll('nav a[href^="#"]').forEach((anchor) => {
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

// 添加滚动动画效果
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// 为所有section添加观察
document.querySelectorAll("section").forEach((section) => {
  section.style.opacity = "0";
  section.style.transform = "translateY(20px)";
  section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
  observer.observe(section);
});

// 动态显示阅读进度
window.addEventListener("scroll", () => {
  const scrolled = window.pageYOffset;
  const maxHeight = document.body.scrollHeight - window.innerHeight;
  const progress = (scrolled / maxHeight) * 100;

  // 可以在这里添加进度条显示
  console.log(`阅读进度: ${progress.toFixed(1)}%`);
});
