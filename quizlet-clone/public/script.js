// 检查是否在浏览器环境中运行
if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('此脚本只能在浏览器环境中运行，不能在Node.js中直接执行');
} else {
    let currentStudyCards = [];
    let currentStudyIndex = 0;
    let editingCardId = null;

    // 显示不同的视图
    function showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.add('hidden');
        });
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.remove('hidden');
        } else {
            console.error(`未找到视图: ${viewName}-view`);
        }
    }

    // 封装元素检查工具函数
    function getElementOrThrow(elementId) {
        const element = document.getElementById(elementId);
        if (!element) {
            throw new Error(`未找到ID为"${elementId}"的元素，请检查HTML`);
        }
        return element;
    }

    // 编辑闪卡功能
    async function editFlashcard(id) {
        try {
            const editQuestionInput = getElementOrThrow('edit-question-input');
            const editAnswerInput = getElementOrThrow('edit-answer-input');
            const editCategoryInput = getElementOrThrow('edit-category-input');

            const response = await fetch(`/api/flashcards/${id}`);
            if (!response.ok) {
                throw new Error(`接口请求失败: ${response.statusText}`);
            }
            const card = await response.json();

            editQuestionInput.value = card.question || '';
            editAnswerInput.value = card.answer || '';
            editCategoryInput.value = card.category || '';

            editingCardId = id;
            showView('edit');

        } catch (error) {
            alert(`获取闪卡详情失败: ${error.message}`);
            console.error('编辑功能错误:', error);
        }
    }

    // 加载所有闪卡
    async function loadFlashcards() {
        try {
            const response = await fetch('/api/flashcards');
            const flashcards = await response.json();
            
            const container = getElementOrThrow('flashcards-list');
            container.innerHTML = '';
            
            flashcards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'flashcard';
                cardElement.innerHTML = `
                    <h3>${card.question}</h3>
                    <p>${card.answer}</p>
                    <p><small>分类: ${card.category || '默认分类'}</small></p>
                    <div class="actions">
                        <button class="edit-btn" onclick="editFlashcard('${card._id}')">编辑</button>
                        <button class="delete-btn" onclick="deleteFlashcard('${card._id}')">删除</button>
                    </div>
                `;
                container.appendChild(cardElement);
            });
        } catch (error) {
            alert('加载闪卡失败: ' + error.message);
        }
    }

    // 创建新闪卡
    async function createFlashcard() {
        try {
            const questionInput = getElementOrThrow('question-input');
            const answerInput = getElementOrThrow('answer-input');
            const categoryInput = getElementOrThrow('category-input');

            const question = questionInput.value;
            const answer = answerInput.value;
            const category = categoryInput.value || '默认分类';

            if (!question || !answer) {
                alert('问题和答案不能为空！');
                return;
            }

            const response = await fetch('/api/flashcards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, answer, category })
            });

            if (response.ok) {
                questionInput.value = '';
                answerInput.value = '';
                categoryInput.value = '';
                loadFlashcards();
                alert('闪卡创建成功！');
            } else {
                alert('创建闪卡失败');
            }
        } catch (error) {
            alert('创建闪卡失败: ' + error.message);
        }
    }

    // 更新闪卡
    async function updateFlashcard() {
        try {
            const questionInput = getElementOrThrow('edit-question-input');
            const answerInput = getElementOrThrow('edit-answer-input');
            const categoryInput = getElementOrThrow('edit-category-input');

            const question = questionInput.value;
            const answer = answerInput.value;
            const category = categoryInput.value;

            if (!question || !answer) {
                alert('问题和答案不能为空！');
                return;
            }

            const response = await fetch(`/api/flashcards/${editingCardId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question, answer, category })
            });

            if (response.ok) {
                alert('闪卡更新成功！');
                loadFlashcards();
                showView('manage');
            } else {
                alert('更新闪卡失败');
            }
        } catch (error) {
            alert('更新闪卡失败: ' + error.message);
        }
    }

    // 删除闪卡
    async function deleteFlashcard(id) {
        if (!confirm('确定要删除这个闪卡吗？')) return;

        try {
            const response = await fetch(`/api/flashcards/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                loadFlashcards();
                alert('闪卡删除成功！');
            } else {
                alert('删除闪卡失败');
            }
        } catch (error) {
            alert('删除闪卡失败: ' + error.message);
        }
    }

    // 学习模式功能
    async function startStudyMode() {
        try {
            const response = await fetch('/api/study');
            currentStudyCards = await response.json();
            
            if (currentStudyCards.length === 0) {
                alert('没有可学习的闪卡！');
                return;
            }

            currentStudyIndex = 0;
            showStudyCard();
            showView('study');
        } catch (error) {
            alert('加载学习数据失败: ' + error.message);
        }
    }

    function markAsKnown() {
        currentStudyCards[currentStudyIndex].known = true;
        nextCard();
    }

    function markAsReview() {
        currentStudyCards[currentStudyIndex].reviewCount = (currentStudyCards[currentStudyIndex].reviewCount || 0) + 1;
        currentStudyCards[currentStudyIndex].lastReviewed = new Date();
        nextCard();
    }

    function showStudyCard() {
        try {
            const card = currentStudyCards[currentStudyIndex];
            const questionElement = getElementOrThrow('study-question');
            const answerElement = getElementOrThrow('study-answer');
            
            questionElement.textContent = card.question || '无问题';
            answerElement.textContent = card.answer || '无答案';
            
            document.querySelector('.card-front').classList.remove('hidden');
            document.querySelector('.card-back').classList.add('hidden');
        } catch (error) {
            alert('显示学习卡片失败: ' + error.message);
        }
    }

    function flipCard() {
        document.querySelector('.card-front').classList.add('hidden');
        document.querySelector('.card-back').classList.remove('hidden');
    }

    function nextCard() {
        currentStudyIndex = (currentStudyIndex + 1) % currentStudyCards.length;
        showStudyCard();
    }

    // 页面加载时初始化 - 合并版
    document.addEventListener('DOMContentLoaded', function() {
        // 1. 检查关键元素是否存在
        const editQuestionInput = document.getElementById('edit-question-input');
        if (!editQuestionInput) {
            console.warn('警告：未找到ID为"edit-question-input"的元素，请检查HTML');
        }
        
        const editAnswerInput = document.getElementById('edit-answer-input');
        if (!editAnswerInput) {
            console.warn('警告：未找到ID为"edit-answer-input"的元素，请检查HTML');
        }
        
        const editCategoryInput = document.getElementById('edit-category-input');
        if (!editCategoryInput) {
            console.warn('警告：未找到ID为"edit-category-input"的元素，请检查HTML');
        }

        // 2. 原有初始化逻辑
        loadFlashcards();
        showView('manage');
    });



       

    // 将函数暴露到全局，以便HTML中的onclick调用
    window.editFlashcard = editFlashcard;
    window.deleteFlashcard = deleteFlashcard;
    window.createFlashcard = createFlashcard;
    window.updateFlashcard = updateFlashcard;
    window.startStudyMode = startStudyMode;
    window.markAsKnown = markAsKnown;
    window.markAsReview = markAsReview;
    window.flipCard = flipCard;
    window.nextCard = nextCard;
}
