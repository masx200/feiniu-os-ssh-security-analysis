import { Chart } from "chart.js/auto";
// 安全风险评估图表
const riskCtx = document.getElementById("riskChart").getContext("2d");
const riskChart = new Chart(riskCtx, {
  type: "doughnut",
  data: {
    labels: [
      "Root权限直接登录",
      "密码认证启用",
      "IPv6端口暴露",
      "权限配置不当",
      "缺乏监控审计",
    ],
    datasets: [{
      data: [85, 75, 80, 90, 65],
      backgroundColor: [
        "#ef4444", // red-500
        "#f59e0b", // amber-500
        "#ef4444", // red-500
        "#ef4444", // red-500
        "#f59e0b", // amber-500
      ],
      borderColor: "#ffffff",
      borderWidth: 3,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.label + ": " + context.raw + "%";
          },
        },
      },
    },
    cutout: "60%",
  },
});
