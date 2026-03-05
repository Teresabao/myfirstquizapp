let allFlashcards = [];
let studyCards = [];
let currentStudyIndex = 0;
let editingCardId = null;

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();
    loadFlashcards();
});

function showView(viewName) {
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${viewName}-view`).classList.remove('hidden');
    if (viewName === 'manage') loadFlashcards();
    if (viewName === 'study') {
        document.getElementById('study-setup').classList.remove('hidden');
        document.getElementById('study-card-area').classList.add('hidden');
        document.getElementById('spell-card-area').classList.add('hidden'); // 确保拼写区域也隐藏
    }
}

// === 分类逻辑 ===
// ==========================================
// 获取所有分类并填充到各个下拉框
// ==========================================
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();

        // 1. 找到页面上的三个下拉框
        const selectManage = document.getElementById('category-select') || document.getElementById('manage-category-select'); 
        const selectStudy = document.getElementById('study-category-select');
        const selectFilter = document.getElementById('filter-category-select'); // 👈 新增的筛选下拉框

        // 2. 清空它们，并设置好“默认的第一个选项”
        if (selectManage) selectManage.innerHTML = '';
        if (selectStudy) selectStudy.innerHTML = '<option value="all">📚 全部卡片 (混合复习)</option>';
        if (selectFilter) selectFilter.innerHTML = '<option value="all">📁 查看所有分类</option>'; 

        // 3. 遍历数据库里的分类，挨个塞进这三个下拉框里
        categories.forEach(category => {
            const optionHtml = `<option value="${category._id}">${category.name}</option>`;
            
            if (selectManage) selectManage.insertAdjacentHTML('beforeend', optionHtml);
            if (selectStudy) selectStudy.insertAdjacentHTML('beforeend', optionHtml);
            if (selectFilter) selectFilter.insertAdjacentHTML('beforeend', optionHtml); // 👈 关键：把数据喂给筛选框
        });

    } catch (error) {
        console.error('获取分类失败:', error);
    }
}
function openCategoryModal() {
    document.getElementById('category-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
}

function closeCategoryModal() {
    document.getElementById('category-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}

async function confirmCategory() {
    const nameInput = document.getElementById('new-category-input');
    const name = nameInput.value.trim();
    if (!name) return alert('分类名称不能为空！');

    try {
        const response = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }) 
        });
        if (response.ok) {
            alert('分类添加成功！');
            nameInput.value = ''; 
            closeCategoryModal(); 
            await loadCategories(); 
        } else { alert('添加失败'); }
    } catch (error) { console.error(error); }
}

async function deleteSelectedCategory() {
    const select = document.getElementById('category-select');
    const categoryId = select.value;
    const categoryName = select.options[select.selectedIndex]?.text;

    if (!categoryId) return alert('请先在下拉菜单中选择你要删除的分类！');
    
    // 二次确认，防止误删
    if (!confirm(`⚠️ 危险操作！\n确定要删除分类【${categoryName}】吗？\n这将会同时删除该分类下的所有卡片，且无法恢复！`)) return;

    try {
        const response = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
        if (response.ok) {
            alert('删除成功！');
            await loadCategories(); // 刷新分类列表
            loadFlashcards();       // 刷新卡片列表（被删分类的卡片会消失）
        }
    } catch (error) { console.error(error); }
}
// === 闪卡逻辑 ===
async function loadFlashcards() {
    try {
        const response = await fetch('/api/flashcards');
        allFlashcards = await response.json();
        renderCards(allFlashcards); // 抽离成单独的渲染函数
    } catch (error) { console.error(error); }
}

// 渲染卡片列表 (方便搜索时复用)
// 替换原来的 renderCards 函数
function renderCards(cardsToRender) {
    const list = document.getElementById('flashcards-list');
    list.innerHTML = '';
    
    const now = new Date();
    
    cardsToRender.forEach(card => {
        const categoryName = card.category ? card.category.name : '未分类';
        
        // 兼容旧数据：如果没有 nextReviewDate，就当作需要立刻复习
        const reviewDate = card.nextReviewDate ? new Date(card.nextReviewDate) : now;
        const isDue = reviewDate <= now;
        
        // 智能状态显示
        const statusHtml = isDue 
            ? '<span style="color: #ed8936; font-size: 0.85rem; margin-left: 8px; font-weight: bold;">🔥 待复习</span>' 
            : `<span style="color: #48bb78; font-size: 0.85rem; margin-left: 8px; font-weight: bold;">✅ ${reviewDate.getMonth()+1}月${reviewDate.getDate()}日复习</span>`;

        list.innerHTML += `
            <div class="card-item">
                <div class="card-content">
                    <strong>Q: ${card.question}</strong>
                    <p>A: ${card.answer}</p>
                    <small>分类: ${categoryName}</small> ${statusHtml}
                </div>
                <div class="card-actions">
                    <button onclick="editFlashcard('${card._id}')">编辑</button>
                    <button onclick="deleteFlashcard('${card._id}')">删除</button>
                </div>
            </div>
        `;
    });
}
// ✨ 新增：实时搜索过滤功能
function filterCards() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filterCategoryId = document.getElementById('filter-category-select').value;

    const filteredCards = allFlashcards.filter(card => {
        const categoryName = card.category ? card.category.name.toLowerCase() : '';
        // 1. 查文本
        const matchesSearch = card.question.toLowerCase().includes(searchTerm) || 
                              card.answer.toLowerCase().includes(searchTerm) ||
                              categoryName.includes(searchTerm);
        // 2. 查分类
        const matchesCategory = filterCategoryId === 'all' || (card.category && card.category._id === filterCategoryId);
        
        return matchesSearch && matchesCategory;
    });
    renderCards(filteredCards);
}

async function createFlashcard() {
    const question = document.getElementById('question-input').value;
    const answer = document.getElementById('answer-input').value;
    const categoryId = document.getElementById('category-select').value; 
    if (!question || !answer) return alert('问题和答案不能为空！');
    if (!categoryId) return alert('请先选择分类！');

    try {
        const response = await fetch('/api/flashcards', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, answer, categoryId }) 
        });
        if (response.ok) {
            document.getElementById('question-input').value = '';
            document.getElementById('answer-input').value = '';
            loadFlashcards();
        }
    } catch (error) { console.error(error); }
}

async function deleteFlashcard(id) {
    if (!confirm('确定要删除吗？')) return;
    await fetch(`/api/flashcards/${id}`, { method: 'DELETE' });
    loadFlashcards();
}

function editFlashcard(id) {
    const card = allFlashcards.find(c => c._id === id);
    if (!card) return;
    editingCardId = id;
    document.getElementById('edit-question-input').value = card.question;
    document.getElementById('edit-answer-input').value = card.answer;
    if (card.category) document.getElementById('edit-category-select').value = card.category._id;
    showView('edit');
}

async function updateFlashcard() {
    const question = document.getElementById('edit-question-input').value;
    const answer = document.getElementById('edit-answer-input').value;
    const categoryId = document.getElementById('edit-category-select').value;
    
    await fetch(`/api/flashcards/${editingCardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer, categoryId })
    });
    showView('manage');
}

// === ✨ 升级版学习模式逻辑 ===
// 替换原来的 startStudyMode 函数
function startReciteMode() {
    const selectedCategoryId = document.getElementById('study-category-select').value;
    // 获取用户设置的上限数量
    const limitInput = document.getElementById('study-limit').value;
    const maxCards = parseInt(limitInput) || 20; 
    
    const now = new Date();
    
    // 1. 粗筛：找出所有到期的卡片
    let dueCards = allFlashcards.filter(card => {
        const date = card.nextReviewDate ? new Date(card.nextReviewDate) : new Date(0);
        // 如果选了分类，还要校验分类是否匹配
        const isCategoryMatch = selectedCategoryId === 'all' || (card.category && card.category._id === selectedCategoryId);
        return date <= now && isCategoryMatch;
    });

    if (dueCards.length === 0) {
        alert('🎉 太棒了！当前分类下的复习任务已经全部清空啦！');
        showView('manage');
        return;
    }
    
    // ✨ 2. 智能排序核心逻辑：优先复习旧卡片，再学新卡片
    dueCards.sort((a, b) => {
        // 如果有 interval (记忆阶段)，阶段越高的越优先复习，防止遗忘
        const intervalA = a.interval || 0;
        const intervalB = b.interval || 0;
        if (intervalB !== intervalA) {
            return intervalB - intervalA; 
        }
        // 如果都是新卡片，打乱顺序
        return Math.random() - 0.5; 
    });

    // ✨ 3. 截断：只取用户设定好的数量！
    studyCards = dueCards.slice(0, maxCards);
    
    // 准备进入学习
    currentStudyIndex = 0;
    
    document.getElementById('study-setup').classList.add('hidden');
    document.getElementById('study-card-area').classList.remove('hidden');
    
    renderStudyCard();
}

function startSpellMode() {
    // ✨ 改动：现在去读取统一的 study-category-select 和 study-limit
    const selectedCategoryId = document.getElementById('study-category-select').value;
    const limitInput = document.getElementById('study-limit').value;
    const maxCards = parseInt(limitInput) || 20; 
    
    const now = new Date();
    
    // 筛选到期的卡片
    let dueCards = allFlashcards.filter(card => {
        const date = card.nextReviewDate ? new Date(card.nextReviewDate) : new Date(0);
        const isMatch = selectedCategoryId === 'all' || (card.category && card.category._id === selectedCategoryId);
        return date <= now && isMatch;
    });

    if (dueCards.length === 0) {
        alert('🎉 太棒了！今天没有需要检验的卡片！');
        return showView('manage');
    }
    
    // 优先复习旧卡片
    dueCards.sort((a, b) => {
        const intervalA = a.interval || 0;
        const intervalB = b.interval || 0;
        if (intervalB !== intervalA) return intervalB - intervalA; 
        return Math.random() - 0.5; 
    });

    // 截断数量
    spellCards = dueCards.slice(0, maxCards);
    currentSpellIndex = 0;
    
    document.getElementById('study-setup').classList.add('hidden');
    document.getElementById('spell-card-area').classList.remove('hidden'); // ✨ 显示拼写区域
    renderSpellCard();
}

function renderStudyCard() {
    if (currentStudyIndex >= studyCards.length) {
        alert('🎉 恭喜你，完成了所选卡片的复习！');
        showView('manage');
        return;
    }
    const card = studyCards[currentStudyIndex];
    document.getElementById('study-question').innerText = card.question;
    document.getElementById('study-answer').innerText = card.answer;
    
    // ✨ 确保每次显示新卡片时，都是正面朝上
    const cardInner = document.getElementById('card-inner');
    if (cardInner) cardInner.classList.remove('is-flipped');

    // ✨ 更新进度条的文字和蓝色填充长度
    const currentNum = currentStudyIndex + 1;
    const totalNum = studyCards.length;
    document.getElementById('study-progress-text').innerText = `当前第 ${currentNum} 张 / 共 ${totalNum} 张`;
    
    const percentage = (currentNum / totalNum) * 100;
    document.getElementById('progress-bar-fill').style.width = `${percentage}%`;
    
    document.getElementById('study-prev-btn').style.display = currentStudyIndex === 0 ? 'none' : 'inline-block';
}

function flipCard() { 
    // ✨ 核心魔法：不再是隐藏显示，而是给卡片添加/移除翻转的 CSS 类
    document.getElementById('card-inner').classList.toggle('is-flipped'); 
}
function nextCard() { currentStudyIndex++; renderStudyCard(); }
// 替换原来的 markAsKnown 函数
async function submitReview(isKnown) {
    const currentCard = studyCards[currentStudyIndex];
    try {
        await fetch(`/api/flashcards/${currentCard._id}/review`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isKnown })
        });
    } catch (error) { console.error('记录失败:', error); }
    
    // 界面表现逻辑
    if (isKnown) {
        nextCard(); // 记住了，看下一张
    } else {
        studyCards.push(currentCard); // 忘了，把这张卡塞到队列最后面，今天必须再背一遍！
        nextCard();
    }
}

function markAsKnown() { submitReview(true); }
function markAsReview() { submitReview(false); }

// ==========================================
// 批量导入逻辑 (Batch Import)
// ==========================================
function openBatchModal() {
    // 每次打开弹窗时，把最新的分类列表同步过来
    const selectBatch = document.getElementById('batch-category-select');
    const selectManage = document.getElementById('category-select');
    selectBatch.innerHTML = selectManage.innerHTML;
    
    document.getElementById('batch-input').value = ''; // 清空输入框
    document.getElementById('batch-modal').style.display = 'block';
    document.getElementById('modal-overlay').style.display = 'block';
}

function closeBatchModal() {
    document.getElementById('batch-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
}

async function confirmBatchImport() {
    const categoryId = document.getElementById('batch-category-select').value;
    const rawText = document.getElementById('batch-input').value.trim();
    
    if (!categoryId) return alert('请先选择要导入的分类！');
    if (!rawText) return alert('你还没输入任何内容呢！');

    // ✨ 核心解析器：将文本转换成卡片数据
    const lines = rawText.split('\n');
    const cardsToImport = [];

    for (let line of lines) {
        if (!line.trim()) continue; // 跳过空行
        
        // 兼容两种分隔符：制表符 \t (表格复制自带) 或者 竖线 |
        let parts = line.split('\t'); 
        if (parts.length < 2) parts = line.split('|');

        if (parts.length >= 2) {
            cardsToImport.push({
                question: parts[0].trim(),
                answer: parts[1].trim()
            });
        }
    }

    if (cardsToImport.length === 0) {
        return alert('未能识别出有效的卡片，请检查格式是否正确。');
    }

    // 发送给后端
    try {
        const response = await fetch('/api/flashcards/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cards: cardsToImport, categoryId })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`🎉 ${result.message}`);
            closeBatchModal();
            loadFlashcards(); // 刷新列表，立刻看到新卡片
        } else {
            alert('导入失败，请检查网络或格式。');
        }
    } catch (error) {
        console.error('批量导入出错:', error);
    }
}

// ==========================================
// 🔊 语音发音功能 (Text-to-Speech)
// ==========================================
// ==========================================
// 🔊 智能双语发音功能 (Text-to-Speech)
// ==========================================
function speakWord(text, event) {
    // 阻止事件冒泡，防止卡片翻转
    if (event) event.stopPropagation(); 

    // 取消当前正在播放的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // ✨ 核心魔法：使用正则表达式检测是否包含中文字符
    const isChinese = /[\u4e00-\u9fa5]/.test(text);

    if (isChinese) {
        // 如果检测到中文
        utterance.lang = 'zh-CN'; // 切换到中文普通话
        utterance.rate = 1.0;     // 中文用正常语速比较自然
    } else {
        // 如果没有中文（默认当做英文处理）
        utterance.lang = 'en-US'; // 切换到美式英语
        utterance.rate = 0.9;     // 英文稍微慢一点，方便听音
    }
    
    // 让浏览器读出来！
    window.speechSynthesis.speak(utterance);
}

// ==========================================
// ✏️ 拼写模式核心逻辑
// ==========================================
let spellCards = [];
let currentSpellIndex = 0;

function startSpellMode() {
    const selectedCategoryId = document.getElementById('study-category-select').value;
    const limitInput = document.getElementById('study-limit').value;
    const maxCards = parseInt(limitInput) || 20; 
    const now = new Date();
    
    let dueCards = allFlashcards.filter(card => {
        const date = card.nextReviewDate ? new Date(card.nextReviewDate) : new Date(0);
        const isMatch = selectedCategoryId === 'all' || (card.category && card.category._id === selectedCategoryId);
        return date <= now && isMatch;
    });

    if (dueCards.length === 0) {
        alert('🎉 太棒了！今天没有需要检验的卡片！');
        return showView('manage');
    }
    
    dueCards.sort((a, b) => {
        const intervalA = a.interval || 0;
        const intervalB = b.interval || 0;
        if (intervalB !== intervalA) return intervalB - intervalA; 
        return Math.random() - 0.5; 
    });

    spellCards = dueCards.slice(0, maxCards);
    currentSpellIndex = 0;
    
    document.getElementById('study-setup').classList.add('hidden');
    document.getElementById('spell-card-area').classList.remove('hidden');
    renderSpellCard();
}

function renderSpellCard() {
    if (currentSpellIndex >= spellCards.length) {
        alert('🏆 恭喜你，完成了所有的拼写检验！');
        return showView('manage');
    }
    
    const card = spellCards[currentSpellIndex];
    document.getElementById('spell-question').innerText = card.question || '（空问题）';
    
    const inputEl = document.getElementById('spell-input');
    inputEl.value = '';
    inputEl.disabled = false;
    inputEl.focus(); 
    
    document.getElementById('spell-feedback').innerHTML = '';
    document.getElementById('spell-next-control').classList.add('hidden');
    document.getElementById('spell-progress-text').innerText = `当前第 ${currentSpellIndex + 1} 张 / 共 ${spellCards.length} 张`;
    document.getElementById('spell-prev-btn').style.display = currentSpellIndex === 0 ? 'none' : 'inline-block';
}

// ==========================================
// 🧠 升级版：回车键智能判断 (批改 or 下一张)
// ==========================================
function handleSpellEnter(event) {
    if (event.key === 'Enter') {
        const inputEl = document.getElementById('spell-input');
        // 如果输入框已经被禁用了（说明刚刚已经批改过了）
        if (inputEl.disabled) {
            nextSpellCard(); // 再次按回车，直接进入下一张！
        } else {
            checkSpelling(); // 还没批改，按回车提交批改
        }
    }
}

async function checkSpelling() {
    const inputEl = document.getElementById('spell-input');
    
    // 如果已经批改过了（输入框被锁定），再次触发则直接进入下一张
    if (inputEl.disabled) return nextSpellCard(); 

    const inputStr = inputEl.value.trim().toLowerCase(); 

    // ✨ 核心修复：防止手滑空提交
    if (inputStr === '') {
        // 让输入框变红，并临时修改提示语警告一下
        inputEl.style.borderColor = '#e53e3e'; 
        inputEl.placeholder = '⚠️ 请先输入单词哦！';
        
        // 1.5秒后恢复原样
        setTimeout(() => {
            inputEl.style.borderColor = 'transparent'; // 恢复我们之前写的现代极简无边框
            inputEl.placeholder = '请在此输入对应的答案...';
        }, 1500);
        
        return; // 🛑 拦截执行，直接退出！不再往下走批改流程
    }

    // --- 下面的代码保持原样 ---
    const card = spellCards[currentSpellIndex];
    if (!card || !card.answer) return console.error("❌ 这张卡片没有答案，无法校验！");

    const answerStr = card.answer.trim().toLowerCase();  
    const feedbackEl = document.getElementById('spell-feedback');
    inputEl.disabled = true; 

    const isCorrect = (inputStr === answerStr);

    if (isCorrect) {
        feedbackEl.innerHTML = '✅ <strong>拼写正确！</strong> 完全掌握！';
        feedbackEl.style.color = '#48bb78';
        if (typeof speakWord === 'function') speakWord(card.answer, null); 
    } else {
        feedbackEl.innerHTML = `❌ <strong>拼写错误。</strong><br><br>你的输入：<span style="color:red; text-decoration: line-through;">${inputStr}</span><br>正确答案：<span style="color:green;">${card.answer}</span>`;
        feedbackEl.style.color = '#e53e3e';
        spellCards.push(card); 
    }

    try {
        await fetch(`/api/flashcards/${card._id}/review`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isKnown: isCorrect })
        });
    } catch(e) { console.error("网络请求失败", e); }

    const nextCtrl = document.getElementById('spell-next-control');
    if(nextCtrl) nextCtrl.classList.remove('hidden');
}

// ==========================================
// ⌨️ 全局键盘快捷键控制中心 (Keyboard Shortcuts)
// ==========================================

// 补充一个纯净版的“下一张”背诵功能（不计入成绩，只用来左右翻看）
function nextStudyCard() {
    if (typeof studyCards !== 'undefined' && currentStudyIndex < studyCards.length - 1) {
        currentStudyIndex++;
        renderStudyCard();
    }
}

// 监听全键盘按键
document.addEventListener('keydown', function(event) {
    // 🛡️ 安全机制：如果用户正在“搜索框”里打字，千万不要触发快捷键！
    const activeTag = document.activeElement.tagName.toLowerCase();
    const isTyping = (activeTag === 'input' || activeTag === 'textarea');
    const isSpellInput = (document.activeElement.id === 'spell-input');
    
    // 如果在普通输入框里打字，直接忽略（默写框除外）
    if (isTyping && !isSpellInput) return;

    const studyArea = document.getElementById('study-card-area');
    const spellArea = document.getElementById('spell-card-area');

    // ----------------------------------------
    // 📖 A. 当处于【背诵模式】时生效的快捷键
    // ----------------------------------------
    if (studyArea && !studyArea.classList.contains('hidden')) {
        switch(event.code) {
            case 'Space': // 空格键：翻转卡片
                event.preventDefault(); // 防止按空格时网页往下滚
                if (typeof flipCard === 'function') flipCard();
                break;
            case 'ArrowLeft': // 左箭头：上一张
                if (typeof prevStudyCard === 'function') prevStudyCard();
                break;
            case 'ArrowRight': // 右箭头：下一张 (纯浏览)
                nextStudyCard();
                break;
            case 'Digit1': // 数字键 1：需要复习
                if (typeof markAsReview === 'function') markAsReview();
                break;
            case 'Digit2': // 数字键 2：已掌握
                if (typeof markAsKnown === 'function') markAsKnown();
                break;
        }
    }

    // ----------------------------------------
    // ✏️ B. 当处于【默写模式】时生效的快捷键
    // ----------------------------------------
    if (spellArea && !spellArea.classList.contains('hidden')) {
        switch(event.code) {
            case 'ArrowLeft': // 左箭头：上一张
                if (typeof prevSpellCard === 'function') prevSpellCard();
                break;
            case 'ArrowRight': // 右箭头：直接跳过看下一张
                if (typeof nextSpellCard === 'function') nextSpellCard();
                break;
            case 'Enter': 
            case 'NumpadEnter':
                const inputEl = document.getElementById('spell-input');
                // ✨ 核心修复：无论焦点在哪，只要输入框被锁定了（说明刚批改完）
                // 再次按下回车，就无条件强制跳转到下一张！
                if (inputEl && inputEl.disabled) {
                    event.preventDefault(); // 阻止浏览器默认的回车滚动行为
                    if (typeof nextSpellCard === 'function') nextSpellCard();
                }
                break;
        }
    }
});



// 👇 直接在文件最后一行追加粘贴：
// ====== 回退功能逻辑 ======
function prevStudyCard() {
    if (currentStudyIndex > 0) {
        currentStudyIndex--;
        renderStudyCard();
    }
}

function prevSpellCard() {
    if (currentSpellIndex > 0) {
        currentSpellIndex--;
        renderSpellCard();
    }
}

// ====== 补回丢失的下一张逻辑 ======
function nextSpellCard() {
    currentSpellIndex++;
    renderSpellCard();
}
